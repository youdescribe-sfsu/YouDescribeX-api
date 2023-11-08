import { NextFunction, Request, Response } from 'express';
import WishListService from '../services/wishlist.service';
import { WishListRequest } from '../dtos/wishlist.dto';
import { IUser } from '../models/mongodb/User.mongo';
import { MongoUsersModel } from '../models/mongodb/init-models.mongo';

class WishListController {
  public wishlistService = new WishListService();

  public getAllWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filterBody: WishListRequest = req.body;
      const wishlistResponse = await this.wishlistService.getAllWishlist(filterBody);
      res.status(201).json(wishlistResponse);
    } catch (error) {
      next(error);
    }
  };

  public getUserWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const pageNumber = req.query.pageNumber as string;
      if (!userData) {
        throw new Error('User not logged in');
      }
      const user = await MongoUsersModel.findById(userData._id);
      if (!user) {
        throw new Error('User not found');
      }
      const wishlistResponse = await this.wishlistService.getUserWishlist(user._id, pageNumber);
      res.status(201).json(wishlistResponse);
    } catch (error) {
      next(error);
    }
  };
}

export default WishListController;
