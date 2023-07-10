import { NextFunction, Request, Response } from 'express';
import WishListService from '../services/wishlist.service';
import { WishListRequest } from '../dtos/wishlist.dto';

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
}

export default WishListController;
