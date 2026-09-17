import 'dotenv/config';
//File for reading variables from the .env file. 
const env = process.env.NODE_ENV ?? 'development';

/* 
Reads a variable from the env file and returns its value. 
name: name to be read from the file. 
Returns 'undefined' if no variable is found. 
*/ 
function get_env_val(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `Missing ${name}. Please Copy server/.env.example to server/.env and fill it in properly.`,
    );
  }
  return value;
}

//Using freeze here to prevent anyone from modifying the env values. 
export const config = Object.freeze({
  env,
  port: Number(process.env.PORT),

  databaseUrl: get_env_val('DATABASE_URL',),

  //Separate secrets so a leaked access token secret can't be used to forge refresh tokens.
  accessTokenSecret: get_env_val('ACCESS_TOKEN_SECRET'),
  refreshTokenSecret: get_env_val('REFRESH_TOKEN_SECRET'),

  clientOrigin: get_env_val('CLIENT_ORIGIN') 
});
