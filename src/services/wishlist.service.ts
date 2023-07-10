import { WishListRequest } from '../dtos/wishlist.dto';
import { IWishList } from '../models/mongodb/Wishlist.mongo';
import { MongoWishListModel } from '../models/mongodb/init-models.mongo';

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

    console;
    return {
      totalItems: wishListItems[0].count[0].count,
      page: pageNumber,
      pageSize,
      data: wishListItems[0].items,
    };
  }
}

export default WishListService;
