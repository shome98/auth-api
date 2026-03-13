# set the image
FROM node:20-alpine AS app-builder

# crreate user group and and adduser to the group
RUN addgroup -S api-auth-group && adduser -S -G api-auth-group api-auth-user

# create workdir (Docker creates this as root by default)
WORKDIR /app

# copy package json and package-lock.json files
# We copy these first to leverage Docker's layer caching
COPY package*.json ./

# change the ownership of currect directory to use:group directory
# We do this while still root so we have the permissions to change it
RUN chown -R api-auth-user:api-auth-group /app

# install dependencies
# We run install BEFORE copying the rest of the code so it doesn't re-run on every code change
RUN npm install

# copy other files
# The --chown flag here ensures files are copied with correct permissions immediately
COPY --chown=api-auth-user:api-auth-group . .

# change the user from root
# We switch to the non-root user last so it is active for the CMD and runtime
USER api-auth-user

# expose the port to listen
EXPOSE 9879

# start the app
CMD ["npm", "run", "dev"]