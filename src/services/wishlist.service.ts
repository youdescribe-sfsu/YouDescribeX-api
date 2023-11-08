import { WishListRequest } from '../dtos/wishlist.dto';
import { IWishList } from '../models/mongodb/Wishlist.mongo';
import { HttpException } from '../exceptions/HttpException';
import { MongoAICaptionRequestModel, MongoUsersModel, MongoWishListModel } from '../models/mongodb/init-models.mongo';

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
}

export default WishListService;
