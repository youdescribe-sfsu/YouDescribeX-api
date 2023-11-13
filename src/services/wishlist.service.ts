import { WishListRequest } from '../dtos/wishlist.dto';
import { IWishList } from '../models/mongodb/Wishlist.mongo';
import { HttpException } from '../exceptions/HttpException';
import { MongoAICaptionRequestModel, MongoUserVotesModel, MongoUsersModel, MongoVideosModel, MongoWishListModel } from '../models/mongodb/init-models.mongo';
import { IUser } from '../models/mongodb/User.mongo';
import { formattedDate } from '../utils/util';
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

  public async getUserWishlist(user_id: string, pageNumber: string) {
    if (!user_id) {
      throw new HttpException(400, 'No data provided');
    }

    const page = parseInt(pageNumber, 10);
    const perPage = 4;
    const skipCount = Math.max((page - 1) * perPage, 0);

    const userIdObject = await MongoUsersModel.findById(user_id);
    const userWishlist = await MongoAICaptionRequestModel.find({
      user: userIdObject._id,
    });

    const youtubeIds = userWishlist.map(entry => entry.youtube_id);

    const statusMap = new Map();
    userWishlist.forEach(entry => {
      statusMap.set(entry.youtube_id, entry.status);
    });

    const wishListEntries = await MongoWishListModel.find({
      youtube_id: { $in: youtubeIds },
    })
      .skip(skipCount)
      .limit(perPage);

    const wishListEntriesWithStatus = wishListEntries.map(entry => ({
      ...entry.toObject(),
      status: statusMap.get(entry.youtube_id),
    }));

    return wishListEntriesWithStatus;
  }

  public async addOneWishlistItem(youtube_id: string, user: IUser): Promise<any> {
    const video = await MongoVideosModel.findOne({ youtube_id: youtube_id }).populate({ path: 'audio_descriptions' }).exec();

    if (!video) {
      throw new HttpException(400, 'Video not found');
    }
    let published = false;
    const audioDescriptions = video.audio_descriptions;

    for (let i = 0; i < audioDescriptions.length; ++i) {
      if (audioDescriptions[i].status === 'published') {
        published = true;
        break;
      }
    }

    if (published) {
      throw new HttpException(400, 'The requested video already has audio description');
    }

    const userVote = await MongoUserVotesModel.findOne({ user: user._id, youtube_id: youtube_id });

    if (userVote) {
      throw new HttpException(400, 'User has already voted for this video');
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
      return {
        status: 200,
        message: 'The requested video is already in the wish list',
      };
    }

    const newWishList = new MongoWishListModel({
      youtube_id: youtube_id,
      status: 'queued',
      votes: 1,
      created_at: formattedDate(new Date()),
      updated_at: formattedDate(new Date()),
    });

    const wishListItemSaved = await newWishList.save();

    // Fetch YouTube video details

    await this.updateWishListItem(wishListItemSaved);
    return {
      status: 200,
      message: 'The requested video is added to the wish list',
    };
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
}
export default WishListService;
