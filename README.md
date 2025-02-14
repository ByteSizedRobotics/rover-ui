# Rover UI

Web app to interact with rover. Includes a docker-compose to get a working example running quickly.

## Features

* Login and registration
* List of rovers

## Developing

To start the development server. If you are developing locally, make sure to have a working database as well. You can start the postgres service in the docker-compose on its own and it should be fine. Make sure to specify the same `DATABASE_URL` variable within a .env file or as an environmental variable.

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building the Docker image

To build the Docker image of the app. Note that a `DATABASE_URL` environmental variable has to be set during creation, however you must again specify the environmental variable when running it.

```bash
docker build --build-arg DATABASE_URL="postgres://root:mysecretpassword@localhost:5432/local" -t bytesizedrobotics/rover-ui .
```

## Running the Docker image

To run the Docker image. Note that the database must already have the database properly initalized with the schema. The ORIGIN environmental variable is very important as server sided calls will not fonction otherwise. It needs to point to where the web app is running. To access the page you must then go to `http://localhost:3000` specifically. The recommended approach to run the app is to use the docker-compose unless you know what you are doing.

```bash
 docker run -e DATABASE_URL="postgres://root:mysecretpassword@localhost:5432/local" -e ORIGIN=http://localhost:3000 --network rover-ui_default -p 3000:3000 syeadz/rover-ui
```

## Running the image with docker-compose (Recommended)

The recommended approach is to use the docker-compose to automatically start up the app and the database. It will also set up some sample data. You will need to register as a new user in order to see it. Make sure to head to `http://localhost:3000`.

```
docker compose up

# or 

docker compose up -d # detached mode (won't attach to terminal)

# to stop, if attached: crtl+c, if detached: `docker compose down`
# and `docker compose down -v` to delete volume
```

## Notes

* Image can be found here: https://hub.docker.com/r/bytesizedrobotics/rover-ui
* There is an automated Github Actions workflow to build and push the image to Docker Hub whenver there is a published release
* Schema for the database can be found at drizzle/schema.sql
