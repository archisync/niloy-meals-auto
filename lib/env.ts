const requiredEnv = [
  "USERNAME",
  "PASSWORD",
  "AUTH_KEY",
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
] as const;

type RequiredEnvKey = (typeof requiredEnv)[number];

export type ServerEnv = Record<RequiredEnvKey, string>;

let cache: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cache) {
    return cache;
  }

  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Add them to your .env file.`,
    );
  }

  cache = {
    USERNAME: process.env.USERNAME as string,
    PASSWORD: process.env.PASSWORD as string,
    AUTH_KEY: process.env.AUTH_KEY as string,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL as string,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN as string,
  };

  return cache;
}
