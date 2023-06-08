import { Router } from 'express';
import WishListController from '../controllers/wishlist.controller';
import { Routes } from '../interfaces/routes.interface';

class WishListRoute implements Routes {
  public path = '/wishlist';
  public router = Router();
  public usersController = new WishListController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/get-all-wishlist`, this.usersController.getAllWishlist);
  }
}

export default WishListRoute;
