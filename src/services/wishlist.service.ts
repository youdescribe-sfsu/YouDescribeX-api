import { IWishList } from '../models/mongodb/Wishlist.mongo';
import { MongoWishListModel } from '../models/mongodb/init-models.mongo';
class WishListService {
  public async getAllWishlist(): Promise<IWishList[]> {
    const wishlist = await MongoWishListModel.find();
    return wishlist;
  }
}

export default WishListService;
