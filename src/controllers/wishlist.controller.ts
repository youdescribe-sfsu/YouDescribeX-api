import { NextFunction, Request, Response } from 'express';
import WishListService from '../services/wishlist.service';

class WishListController {
  public wishlistService = new WishListService();

  public getAllWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wishlistResponse = await this.wishlistService.getAllWishlist();
      res.status(201).json(wishlistResponse);
    } catch (error) {
      next(error);
    }
  };
}

export default WishListController;
