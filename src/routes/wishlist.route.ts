import { Router } from 'express';
import WishListController from '../controllers/wishlist.controller';
import { Routes } from '../interfaces/routes.interface';
import authMiddleware from '../middlewares/auth.middleware';

class WishListRoute implements Routes {
  public path = '/wishlist';
  public router = Router();
  public wishListController = new WishListController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/add-one-wishlist-item`, authMiddleware, this.wishListController.addOneWishlistItem);
    this.router.post(`${this.path}/get-all-wishlist`, this.wishListController.getAllWishlist);
    this.router.get(`${this.path}/get-user-wishlist`, authMiddleware, this.wishListController.getUserWishlist);
    this.router.get(`${this.path}/get-top-wishlist`, this.wishListController.getTopWishList);
    this.router.get(`${this.path}/top`, this.wishListController.getTopWishListItems);
    this.router.delete(`${this.path}/removeone`, authMiddleware, this.wishListController.removeOne);
  }
}

export default WishListRoute;
