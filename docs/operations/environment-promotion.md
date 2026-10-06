# Environment Promotion

Local, test, staging and production use separate credentials, databases and provider modes. Never promote an `.env` file between environments. Promote code/artifacts; inject environment-specific secrets at deployment. Provider sandbox credentials are not reused in production, and production databases are never cloned into developer laptops without approved sanitization.
