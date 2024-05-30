import { Router } from 'express';
import WishListController from '../controllers/wishlist.controller';
import { Routes } from '../interfaces/routes.interface';

class WishListRoute implements Routes {
  public path = '/wishlist';
  public router = Router();
  public wishListController = new WishListController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/add-one-wishlist-item`, this.wishListController.addOneWishlistItem);
    this.router.post(`${this.path}/get-all-wishlist`, this.wishListController.getAllWishlist);
    this.router.get(`${this.path}/get-user-wishlist`, this.wishListController.getUserWishlist);
    this.router.get(`${this.path}/get-top-wishlist`, this.wishListController.getTopWishList);
    this.router.get(`${this.path}/top`, this.wishListController.getTopWishListItems);
    this.router.delete(`${this.path}/removeone`, this.wishListController.removeOne);
  }
}

export default WishListRoute;
