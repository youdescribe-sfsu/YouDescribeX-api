import AuthRoute from './routes/auth.route';
import IndexRoute from './routes/index.route';
import UsersRoute from './routes/users.route';
import validateEnv from './utils/validateEnv';
import App from './app';

validateEnv();

const app = new App([new UsersRoute()]);

app.listen();
