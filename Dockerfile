
FROM node:18

WORKDIR /app
COPY package* .json ./

# Install the application dependencies
RUN npm install

# Define the entry point for the container
CMD ["node", "index.js"]