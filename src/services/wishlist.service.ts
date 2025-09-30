import { WishListRequest } from '../dtos/wishlist.dto';
import { IWishList } from '../models/mongodb/Wishlist.mongo';
import { HttpException } from '../exceptions/HttpException';
import { MongoAICaptionRequestModel, MongoUserVotesModel, MongoWishListModel } from '../models/mongodb/init-models.mongo';
import { IUser } from '../models/mongodb/User.mongo';
import { formattedDate, getYouTubeVideoStatus } from '../utils/util';
import axios from 'axios';
import { PipelineStage } from 'mongoose';
import getRelevanceScores from '../utils/openAPI.util';
import { LRUCache } from 'lru-cache';
import KeywordVideosModel from '../models/mongodb/KeywordVideos.mongo';
import YouTubeCacheService from '../services/youtube-cache.service';
import { markVideoUnavailable } from '../utils/video-status.utils';
import { YOUTUBE_API_KEY } from '../config';
import { logger } from '../utils/logger';
import { getVideoDataByYoutubeId } from '../utils/videos.util';

interface IWishListResponse {
  items: IWishList[];
  count: Array<{
    count: number;
  }>;
}

class WishListService {
  private cache: LRUCache<string, any>;

  constructor() {
    this.cache = new LRUCache<string, any>({
      maxSize: 300,
      sizeCalculation: () => {
        return 1;
      },
      dispose: (value, key) => {
        try {
          KeywordVideosModel.create({
            keyword: key,
            data: JSON.stringify(value),
          });
        } catch (error) {
          console.error('Error storing removed item:', error);
        }
      },
    });
  }

  // BACKEND FIX: Restore GPT ranking with bulletproof error handling

  public async getAllWishlist(filterBody: WishListRequest): Promise<any> {
    const { sort, category = [], page, limit, sortField, search = '' } = filterBody;

    let sortOptions: any = { created_at: -1 }; // Default sort by created_at in descending order
    if (sort && sortField) {
      if (sortField === 'aiRequested') {
        sortOptions = {
          aiRequested: sort === 'asc' ? 1 : -1,
          created_at: -1, // Secondary sort
        };
      } else if (sortField === 'category') {
        sortOptions = {
          lowercaseCategory: sort === 'asc' ? 1 : -1,
          created_at: -1, // Secondary sort
        };
      } else {
        sortOptions = {
          [sortField]: sort === 'asc' ? 1 : -1,
          created_at: -1, // Secondary sort
        };
      }
    }

    // Apply pagination
    const pageNumber = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 50;
    const skip = (pageNumber - 1) * pageSize;

    let categoryRegex: any = '';
    if (category.length > 0) {
      categoryRegex = category.join('|');
    }

    // Basic match criteria used in multiple places
    const baseMatchCriteria = {
      $and: [
        { status: 'queued' },
        { youtube_status: 'available' },
        { tags: { $regex: search, $options: 'i' } },
        { category: { $regex: categoryRegex, $options: 'i' } },
      ],
    };

    try {
      // DECISION POINT: Use simple aggregation for no search, GPT ranking for actual searches
      if (search === '' || search.trim() === '') {
        console.log('No search term provided, using standard database sorting');

        // Non-search case: Use simple, fast database sorting
        const wishListItems = await MongoWishListModel.aggregate().facet({
          items: [
            { $match: baseMatchCriteria },
            {
              $lookup: {
                from: 'AICaptionRequests',
                localField: 'youtube_id',
                foreignField: 'youtube_id',
                as: 'aiCaptionRequests',
              },
            },
            {
              $addFields: {
                aiRequested: {
                  $cond: {
                    if: { $gt: [{ $size: '$aiCaptionRequests' }, 0] },
                    then: {
                      $cond: {
                        if: { $eq: [{ $arrayElemAt: ['$aiCaptionRequests.status', 0] }, 'completed'] },
                        then: true,
                        else: false,
                      },
                    },
                    else: false,
                  },
                },
                lowercaseCategory: { $toLower: '$category' },
              },
            },
            { $sort: sortOptions },
            { $skip: skip },
            { $limit: pageSize },
          ],
          count: [{ $match: baseMatchCriteria }, { $count: 'count' }],
        });

        const totalCount = wishListItems[0]?.count?.[0]?.count || 0;
        const items = wishListItems[0]?.items || [];

        return {
          totalItems: totalCount,
          page: pageNumber,
          pageSize,
          data: items,
        };
      } else {
        console.log('Search term provided, attempting GPT-ranked results');

        // Search case: Try GPT ranking with multiple fallback layers
        const cacheKey = `${categoryRegex ? `${categoryRegex}-` : ''}${search}`;

        // LAYER 1: Try to get cached GPT rankings
        let rankedData = null;
        try {
          if (this.cache) {
            rankedData = this.cache.get(cacheKey);
            if (rankedData) {
              console.log('Using cached GPT rankings');
            }
          }
        } catch (cacheError) {
          console.warn('Cache access failed, proceeding without cache:', cacheError.message);
        }

        // LAYER 2: Try to get pre-computed rankings from database
        if (!rankedData) {
          try {
            const keywordVideos = await KeywordVideosModel.findOne({ keyword: cacheKey });
            if (keywordVideos?.data) {
              rankedData = JSON.parse(keywordVideos.data);
              // Filter to ensure only valid items remain
              rankedData = rankedData.filter(item => item.status === 'queued' && item.youtube_status === 'available');
              console.log('Using pre-computed keyword rankings');
            }
          } catch (dbError) {
            console.warn('Keyword database lookup failed, proceeding to live GPT ranking:', dbError.message);
          }
        }

        // LAYER 3: Generate new GPT rankings if no cached/pre-computed data exists
        if (!rankedData) {
          try {
            console.log('Generating new GPT rankings for search term:', search);

            // First get all matching items from database
            const wishListItems = await MongoWishListModel.aggregate().facet({
              items: [
                { $match: baseMatchCriteria },
                {
                  $lookup: {
                    from: 'AICaptionRequests',
                    localField: 'youtube_id',
                    foreignField: 'youtube_id',
                    as: 'aiCaptionRequests',
                  },
                },
                {
                  $addFields: {
                    aiRequested: {
                      $cond: {
                        if: { $gt: [{ $size: '$aiCaptionRequests' }, 0] },
                        then: {
                          $cond: {
                            if: { $eq: [{ $arrayElemAt: ['$aiCaptionRequests.status', 0] }, 'completed'] },
                            then: true,
                            else: false,
                          },
                        },
                        else: false,
                      },
                    },
                    lowercaseCategory: { $toLower: '$category' },
                  },
                },
                { $sort: sortOptions },
              ],
              count: [{ $match: baseMatchCriteria }, { $count: 'count' }],
            });

            const items = wishListItems[0]?.items || [];

            if (items.length === 0) {
              console.log('No items found matching search criteria');
              return {
                totalItems: 0,
                page: pageNumber,
                pageSize,
                data: [],
              };
            }

            // CRITICAL: Wrap GPT ranking in timeout and error handling
            const GPT_TIMEOUT_MS = 10000; // 10 second timeout

            const gptRankingPromise = getRelevanceScores(items, search, categoryRegex);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('GPT ranking timeout')), GPT_TIMEOUT_MS));

            rankedData = await Promise.race([gptRankingPromise, timeoutPromise]);
            console.log('GPT ranking completed successfully');

            // Try to cache the successful result
            try {
              if (this.cache && rankedData) {
                this.cache.set(cacheKey, rankedData);
              }
            } catch (cacheError) {
              console.warn('Failed to cache GPT results:', cacheError.message);
            }
          } catch (gptError) {
            console.error('GPT ranking failed, falling back to database sorting:', gptError.message);

            // LAYER 4: Fallback to simple database sorting when GPT fails
            const fallbackItems = await MongoWishListModel.aggregate().facet({
              items: [
                { $match: baseMatchCriteria },
                {
                  $lookup: {
                    from: 'AICaptionRequests',
                    localField: 'youtube_id',
                    foreignField: 'youtube_id',
                    as: 'aiCaptionRequests',
                  },
                },
                {
                  $addFields: {
                    aiRequested: {
                      $cond: {
                        if: { $gt: [{ $size: '$aiCaptionRequests' }, 0] },
                        then: {
                          $cond: {
                            if: { $eq: [{ $arrayElemAt: ['$aiCaptionRequests.status', 0] }, 'completed'] },
                            then: true,
                            else: false,
                          },
                        },
                        else: false,
                      },
                    },
                    lowercaseCategory: { $toLower: '$category' },
                  },
                },
                { $sort: sortOptions },
              ],
              count: [{ $match: baseMatchCriteria }, { $count: 'count' }],
            });

            rankedData = fallbackItems[0]?.items || [];
            console.log('Using database fallback sorting');
          }
        }

        // Apply pagination to ranked results
        const startIndex = (pageNumber - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedData = rankedData.slice(startIndex, endIndex);

        console.log(`Returning ${paginatedData.length} items from ${rankedData.length} total ranked results`);

        return {
          totalItems: rankedData.length,
          page: pageNumber,
          pageSize,
          data: paginatedData,
          rankedByGPT: true, // Flag to indicate GPT ranking was used
        };
      }
    } catch (error) {
      console.error('Error in getAllWishlist:', error);
      console.error('Filter params:', filterBody);

      // FINAL SAFETY NET: Return empty results rather than crashing
      return {
        totalItems: 0,
        page: pageNumber,
        pageSize,
        data: [],
        error: 'Search temporarily unavailable',
      };
    }
  }

  getTopWishlist = async (user_id: string | undefined) => {
    try {
      // Initial fetch of more items than we need (e.g., 8 instead of 5)
      const pipeline: PipelineStage[] = [
        {
          $match: {
            status: 'queued',
            youtube_status: 'available',
          },
        },
        {
          $sort: {
            votes: -1,
            created_at: -1,
          },
        },
        {
          $limit: 25,
        },
        {
          $sample: { size: 8 },
        },
      ];

      const topWishlist = await MongoWishListModel.aggregate(pipeline);

      // Filter out unavailable videos and get the first 5 available ones
      const availableVideos = [];
      for (const video of topWishlist) {
        try {
          const response = await YouTubeCacheService.getVideoData([video.youtube_id]);
          if (response?.items?.length > 0) {
            availableVideos.push(video);
            if (availableVideos.length === 5) break; // Stop once we have 5 videos
          } else {
            // Mark video as unavailable in background
            markVideoUnavailable(video.youtube_id);
          }
        } catch (error) {
          console.warn(`Video ${video.youtube_id} unavailable:`, error);
        }
      }

      return availableVideos;
    } catch (error) {
      console.error('Error in getTopWishlist:', error);
      return [];
    }
  };

  public async getUserWishlist(user_id: string | undefined, pageNumber: string) {
    try {
      if (!user_id) {
        throw new HttpException(400, 'No User ID provided');
      }

      const page = parseInt(pageNumber, 10);
      const perPage = 5;
      const skipCount = Math.max((page - 1) * perPage, 0);

      const userVotes = await MongoUserVotesModel.find({
        user: user_id,
      });

      const youtubeIds = userVotes.map(entry => entry.youtube_id);
      const aiRequestedMap = new Map();
      const aiRequests = await MongoAICaptionRequestModel.find({
        youtube_id: { $in: youtubeIds },
        status: 'completed',
      });

      aiRequests.forEach(request => {
        aiRequestedMap.set(request.youtube_id, true);
      });

      const totalVideos = await MongoWishListModel.countDocuments({
        youtube_id: { $in: youtubeIds },
      });

      const wishListEntries = await MongoWishListModel.find({
        youtube_id: { $in: youtubeIds },
      })
        .sort({ updated_at: -1 })
        .skip(skipCount)
        .limit(perPage);

      const wishListEntriesWithAiRequested = wishListEntries.map(entry => ({
        ...entry.toObject(),
        aiRequested: aiRequestedMap.get(entry.youtube_id) || false,
      }));

      return { result: wishListEntriesWithAiRequested, totalVideos: totalVideos };
    } catch (error) {
      return error;
    }
  }

  public async addOneWishlistItem(youtube_id: string, user: IUser): Promise<any> {
    try {
      const video = await getYouTubeVideoStatus(youtube_id);

      if (!video) {
        return { status: 400, message: 'Video not found' };
      }

      if (video.audio_descriptions.some(ad => ad.status === 'published')) {
        return { status: 400, message: 'The requested video already has audio description' };
      }

      const userVote = await MongoUserVotesModel.findOne({ user: user._id, youtube_id: youtube_id });

      if (userVote) {
        return { status: 400, message: 'User has already voted for this video' };
      }

      const currentDate = formattedDate(new Date());

      const newUserVote = await MongoUserVotesModel.create({
        user: user._id,
        youtube_id: youtube_id,
        updated_at: currentDate,
        created_at: currentDate,
      });

      const wishListItem = await MongoWishListModel.findOne({ youtube_id: youtube_id });

      if (wishListItem) {
        wishListItem.votes = Number(wishListItem.votes) + 1;
        wishListItem.updated_at = Number(currentDate);

        await wishListItem.save();
        return { status: 200, message: 'Vote added successfully' };
      }

      // Get video metadata from YouTube API if needed
      let videoData;
      try {
        videoData = await getVideoDataByYoutubeId(youtube_id);
      } catch (error) {
        console.error('Error fetching video data:', error);
        videoData = null;
      }

      const newWishList = new MongoWishListModel({
        youtube_id: youtube_id,
        status: 'queued',
        votes: 1,
        created_at: currentDate,
        updated_at: currentDate,
        youtube_status: video.youtube_status || 'unknown',
        duration: video.duration || (videoData ? videoData.duration : 0),
        category_id: video.category_id || (videoData ? videoData.category_id : 0),
        category: video.category || (videoData ? videoData.category : 'Uncategorized'),
      });

      try {
        const wishListItemSaved = await newWishList.save();
        await this.updateWishListItem(wishListItemSaved);
        return { status: 200, message: 'The requested video is added to the wish list' };
      } catch (error) {
        // Rollback user vote
        await MongoUserVotesModel.deleteOne({ _id: newUserVote._id });
        console.error('Error in saving wish list item, rolled back vote:', error);
        return { status: 500, message: 'Internal Server Error' };
      }
    } catch (error) {
      console.error('Error in addOneWishlistItem:', error);
      return { status: 500, message: 'Internal Server Error' };
    }
  }

  private convertISO8601ToSeconds = (input: string): number => {
    const reptms = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    let totalseconds;
    if (reptms.test(input)) {
      const matches = reptms.exec(input);
      if (matches[1]) hours = Number(matches[1]);
      if (matches[2]) minutes = Number(matches[2]);
      if (matches[3]) seconds = Number(matches[3]);
      totalseconds = hours * 3600 + minutes * 60 + seconds;
    }
    return totalseconds;
  };

  private async updateWishListItem(wishListItemSaved: IWishList) {
    try {
      // Use the YouTubeCacheService to get video data
      const videoResponse = await YouTubeCacheService.getVideoData([wishListItemSaved.youtube_id]);

      if (videoResponse.items && videoResponse.items.length > 0) {
        const videoItem = videoResponse.items[0];
        const duration = this.convertISO8601ToSeconds(videoItem.contentDetails.duration);
        const tags = videoItem.snippet.tags || [];
        const categoryId = videoItem.snippet.categoryId;

        // Get category data
        const categoryResponse = await axios.get(`https://www.googleapis.com/youtube/v3/videoCategories`, {
          params: {
            id: categoryId,
            part: 'snippet',
            key: YOUTUBE_API_KEY,
          },
        });

        const categoryJsonObj = categoryResponse.data;
        let category = '';

        for (let i = 0; i < categoryJsonObj.items.length; ++i) {
          if (i > 0) {
            category += ',';
          }
          category += categoryJsonObj.items[i].snippet.title;
        }

        const toUpdate = {
          tags: tags,
          category_id: categoryId,
          category: category,
          duration: duration,
          youtube_status: 'available',
        };

        await MongoWishListModel.findOneAndUpdate({ youtube_id: wishListItemSaved.youtube_id }, { $set: toUpdate }, { new: true }).exec();
      } else {
        const toUpdate = {
          youtube_status: 'unavailable',
        };

        await MongoWishListModel.findOneAndUpdate({ youtube_id: wishListItemSaved.youtube_id }, { $set: toUpdate }, { new: true }).exec();
      }
    } catch (error) {
      // Handle errors
      console.error(error);
      logger.error(`Error updating wishlist item: ${error.message}`);
    }
  }

  public async getTopWishListItems(user: IUser | undefined) {
    try {
      let user_votes: any[] = [];

      if (user) {
        user_votes = await MongoUserVotesModel.find({ user: user._id });
      }

      const items = await MongoWishListModel.find({ status: 'queued', youtube_status: 'available' }).sort({ votes: -1 }).limit(5);

      if (items.length > 0) {
        const ret = {
          message: 'Wish list successfully retrieved',
          status: 200,
          type: 'success',
          result: [],
        };
        const new_items = items.map(element => {
          const isVoted = user_votes.some((vote: any) => vote.youtube_id === element.youtube_id);

          if (isVoted) {
            return { ...(element.toObject() as object), voted: true };
          }

          return element;
        });

        ret.result = new_items;
        return ret;
      } else {
        const ret = {
          message: 'No wish list items to delivery at this time',
          status: 400,
          type: 'error',
          result: [],
        };
        return ret;
      }
    } catch (err) {
      // console.log(err);
      const ret = {
        message: 'Error retrieving wish list',
        status: 400,
        type: 'error',
        result: [],
      };
      return ret;
    }
  }

  public async removeOne(userId: string, youTubeId: string) {
    try {
      const wishListItem = await MongoWishListModel.findOne({ youtube_id: youTubeId }).exec();
      // // console.log(wishListItem);
      if (!wishListItem) {
        // Video not found in the wishlist.
        return { status: 404, message: 'Video not found in the wishlist.' };
      }

      // console.log('wishListItem :: ', wishListItem);

      if (wishListItem.votes.valueOf() < 2) {
        // If the vote count is already zero, remove the video from the wishlist.
        await MongoWishListModel.deleteOne({ youtube_id: youTubeId }).exec();
        // Video successfully removed from the wishlist.
        await MongoUserVotesModel.findOneAndDelete({ user: userId, youtube_id: youTubeId }).exec();
        return { status: 200, message: 'Video successfully removed from the wishlist.' };
      } else {
        // Decrease the vote count by 1 and update the wishlist item.
        wishListItem.votes = Number(1) - 1;
        wishListItem.updated_at = Number(formattedDate(new Date()));

        await wishListItem.save();

        // Wishlist item updated successfully.
        await MongoUserVotesModel.findOneAndDelete({ user: userId, youtube_id: youTubeId });
        return { status: 200, message: 'Wishlist item updated successfully.' };
      }
    } catch (err) {
      // console.log(err);
      return { status: 500, message: 'Internal Server Error.' };
    }
  }
}
export default WishListService;
