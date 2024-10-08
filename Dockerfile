# Use the official Node.js 20 image as a base
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on
EXPOSE 8000

# Define the command to run your application
CMD ["npm", "run", "dev"]
