import { WishListRequest } from '../dtos/wishlist.dto';
import { IWishList } from '../models/mongodb/Wishlist.mongo';
import { HttpException } from '../exceptions/HttpException';
import { MongoAICaptionRequestModel, MongoUsersModel, MongoUserVotesModel, MongoVideosModel, MongoWishListModel } from '../models/mongodb/init-models.mongo';
import { IUser } from '../models/mongodb/User.mongo';
import { formattedDate, getYouTubeVideoStatus } from '../utils/util';
import axios from 'axios';
import * as conf from '../utils/youtube_utils';

interface IWishListResponse {
  items: IWishList[];
  count: Array<{
    count: number;
  }>;
}

class WishListService {
  public async getAllWishlist(filterBody: WishListRequest): Promise<any> {
    const { sort, category = [], page, limit, sortField, search = '' } = filterBody;

    let sortOptions: any = { created_at: -1 }; // Default sort by created_at in descending order
    if (sort && sortField) {
      sortOptions = {}; // Clear default sort options
      sortOptions[sortField] = sort === 'asc' ? 1 : -1;
    }

    // Apply pagination
    const pageNumber = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 50;
    const skip = (pageNumber - 1) * pageSize;

    let categoryRegex: any = '';
    if (category.length > 0) {
      categoryRegex = category.join('|');
    }

    const wishListItems: Array<IWishListResponse> = await MongoWishListModel.aggregate().facet({
      items: [
        {
          $match: {
            $and: [
              { status: 'queued' },
              { youtube_status: 'available' },
              { tags: { $regex: search, $options: 'i' } },
              { category: { $regex: categoryRegex, $options: 'i' } },
            ],
          },
        },
        { $sort: sortOptions },
        { $skip: skip },
        { $limit: pageSize },
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
                then: true,
                else: false,
              },
            },
          },
        },
      ],
      count: [
        {
          $match: {
            $and: [
              { status: 'queued' },
              { youtube_status: 'available' },
              { tags: { $regex: search, $options: 'i' } },
              { category: { $regex: categoryRegex, $options: 'i' } },
            ],
          },
        },
        { $count: 'count' },
      ],
    });

    return {
      totalItems: wishListItems[0].count[0].count,
      page: pageNumber,
      pageSize,
      data: wishListItems[0].items,
    };
  }

  public async getTopWishlist(user_id: string | undefined) {
    // console.log('user_id', user_id);
    // if (!user_id) {
    //   throw new HttpException(400, 'No data provided');
    // }
    const userWishlist = await MongoAICaptionRequestModel.aggregate([
      {
        $project: {
          _id: 1,
          youtube_id: 1,
          status: 1,
          captionCount: { $size: '$caption_requests' },
        },
      },
      { $sort: { captionCount: -1 } },
      { $limit: 3 },
    ]);

    const youtubeIds = userWishlist.map(entry => entry.youtube_id);

    const top3AIRequestedVideos = await MongoVideosModel.find({ youtube_id: { $in: youtubeIds }, status: 'completed' }).select({
      tags: 1,
      _id: 1,
      youtube_id: 1,
      votes: 1,
      status: 1,
      created_at: 1,
      updated_at: 1,
      v: 1,
      youtube_status: 1,
      duration: 1,
      category_id: 1,
      category: 1,
    });

    const top3UniqueYouTubeIds = [...new Set(top3AIRequestedVideos.map(video => video.youtube_id))];

    const top2WishlistVideos = await MongoWishListModel.find({
      status: 'queued',
      youtube_status: 'available',
      youtube_id: { $nin: top3UniqueYouTubeIds },
    })
      .sort({ votes: -1 })
      .limit(2);

    const top2WithAiRequested = top2WishlistVideos.map(video => ({ ...video.toObject(), aiRequested: false }));

    // const filteredTop3AIRequested = top3AIRequestedVideos.filter(video => !top3UniqueYouTubeIds.includes(video.youtube_id));

    const top3WithAiRequested = top3AIRequestedVideos.map(video => ({ ...video.toObject(), aiRequested: true }));
    const user_votes = await MongoUserVotesModel.find({ user: user_id });

    const returnArray = [...top3WithAiRequested, ...top2WithAiRequested].map((video: any) => {
      return {
        ...video,
        voted: user_votes.some((vote: any) => vote.youtube_id === video.youtube_id),
      };
    });
    return returnArray;
  }

  public async getUserWishlist(user_id: string | undefined, pageNumber: string) {
    if (!user_id) {
      throw new HttpException(400, 'No data provided');
    }

    const page = parseInt(pageNumber, 10);
    const perPage = 5;
    const skipCount = Math.max((page - 1) * perPage, 0);

    const userIdObject = await MongoUsersModel.findById(user_id);
    const userVotes = await MongoUserVotesModel.find({
      user: userIdObject._id,
    });

    // console.log('userVotes', userVotes);
    const youtubeIds = userVotes.map(entry => entry.youtube_id);
    const aiRequestedMap = new Map();
    const aiRequests = await MongoAICaptionRequestModel.find({
      youtube_id: { $in: youtubeIds },
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
      .skip(skipCount)
      .limit(perPage);

    const wishListEntriesWithAiRequested = wishListEntries.map(entry => ({
      ...entry.toObject(),
      aiRequested: aiRequestedMap.get(entry.youtube_id) || false,
    }));

    return { result: wishListEntriesWithAiRequested, totalVideos: totalVideos };
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

      await MongoUserVotesModel.create({
        user: user._id,
        youtube_id: youtube_id,
        updated_at: formattedDate(new Date()),
        created_at: formattedDate(new Date()),
      });

      const wishListItem = await MongoWishListModel.findOne({ youtube_id: youtube_id });

      if (wishListItem) {
        wishListItem.votes = Number(wishListItem.votes) + 1;
        wishListItem.updated_at = Number(formattedDate(new Date()));

        await wishListItem.save();
        return { status: 400, message: 'The requested video is already in the wish list' };
      }

      const newWishList = new MongoWishListModel({
        youtube_id: youtube_id,
        status: 'queued',
        votes: 1,
        created_at: formattedDate(new Date()),
        updated_at: formattedDate(new Date()),
      });

      const wishListItemSaved = await newWishList.save();

      await this.updateWishListItem(wishListItemSaved);
      return { status: 200, message: 'The requested video is added to the wish list' };
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
      const videoResponse = await axios.get(
        `${conf.youTubeApiUrl}/videos?id=${wishListItemSaved.youtube_id}&part=contentDetails,snippet,statistics&forUsername=iamOTHER&key=${conf.youTubeApiKey}`,
      );

      const jsonObj = videoResponse.data;

      if (jsonObj.items.length > 0) {
        const duration = this.convertISO8601ToSeconds(jsonObj.items[0].contentDetails.duration);
        const tags = jsonObj.items[0].snippet.tags || [];
        const categoryId = jsonObj.items[0].snippet.categoryId;

        const categoryResponse = await axios.get(
          `${conf.youTubeApiUrl}/videoCategories?id=${categoryId}&part=snippet&forUsername=iamOTHER&key=${conf.youTubeApiKey}`,
        );

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
