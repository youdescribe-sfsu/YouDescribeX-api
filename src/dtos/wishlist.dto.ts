export interface WishListRequest {
  sort?: 'asc' | 'desc';
  sortField?: string;
  category?: Array<string>;
  page?: string;
  limit?: string;
  search?: string;
}
