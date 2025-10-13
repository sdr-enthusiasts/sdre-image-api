// Copyright (c) 2024 Fred Clausen
//
// Licensed under the MIT license: https://opensource.org/licenses/MIT
// Permission is granted to use, copy, modify, and redistribute the work.
// Full license information available in the project LICENSE file.

import express from "express";
import { PrismaClient } from "@prisma/client";
import { App } from "octokit";
import winston from "winston";
import * as fs from "fs";
import * as util from "util";
import { IGNORED_REPOS } from "./ignored.js";
const app = express();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();

let APP_ID = process.env.APP_ID;

if (APP_ID === undefined) {
  console.error("APP_ID not set. Exiting");
  process.exit(1);
}

let API_KEY = process.env.API_KEY;

if (API_KEY === undefined) {
  console.error("API_KEY not set. Exiting");
  process.exit(1);
}

const octo_app = new App({
  appId: APP_ID,
  privateKey: fs.readFileSync(API_KEY).toString(),
});

let octokit: any = null;

let alignColorsAndTime = winston.format.combine(
  winston.format.colorize({
    all: true,
  }),
  winston.format.label({
    label: "[IMAGE API]",
  }),
  winston.format.timestamp({
    format: "YY-MM-DD HH:mm:ss",
  }),
  winston.format.printf(
    (info: any) =>
      `${info.label}[${info.timestamp}][${info.service}][${info.level}] ${info.message}`
  )
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV !== "production" ? "debug" : "info",
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        alignColorsAndTime
      ),
    }),
  ],
  defaultMeta: { service: "SDR Image API" },
});

if (process.env.LOG_LEVEL !== undefined) {
  logger.info("Log level inputted as " + process.env.LOG_LEVEL);
  // if the log level is set, we'll use that
  // but verify it's a valid log level
  if (
    ["error", "warn", "info", "http", "verbose", "debug", "silly"].includes(
      process.env.LOG_LEVEL
    )
  ) {
    logger.level = process.env.LOG_LEVEL;
  } else if ([0, 1, 2, 3, 4, 5, 6].includes(parseInt(process.env.LOG_LEVEL))) {
    logger.level = process.env.LOG_LEVEL;
  } else {
    logger.error("Invalid log level set. Defaulting to info", {
      service: "SDR Image API",
    });
    logger.level = "info";
  }
}

app.get(
  "/api/v1/last-updated",
  async (_req: any, res: { json: (arg0: { lastUpdated: any }) => void }) => {
    let lastUpdatedOutput = null;

    await prisma.lastUpdated
      .findMany({
        take: 1,
        orderBy: {
          time: "desc",
        },
      })
      .then((lastUpdated: any) => {
        if (lastUpdated.length > 0) {
          lastUpdatedOutput = lastUpdated[0].time;
        }
      })
      .catch((e: any) => {
        logger.error(e, { service: "SDR API /api/v1/last-updated" });
      });

    return res.json({ lastUpdated: lastUpdatedOutput || "never" });
  }
);

app.get(
  "/api/v1/images/all",
  async (_req: any, res: { json: (arg0: { images: any }) => void }) => {
    let images = await prisma.images
      .findMany({
        orderBy: {
          name: "asc",
        },
      })
      .catch((e: any) => {
        logger.error(e);
      });

    return res.json({ images: images });
  }
);

app.get(
  "/api/v1/images/all/stable",
  async (_req: any, res: { json: (arg0: { images: any }) => void }) => {
    let images = await prisma.images
      .findMany({
        where: {
          stable: true,
        },
        orderBy: {
          name: "asc",
        },
      })
      .catch((e: any) => {
        logger.error(e);
      });

    return res.json({ images: images });
  }
);

app.get(
  "/api/v1/images/trixie/all/recommended",
  async (_req: any, res: any) => {
    let images = await prisma.images
      .findMany({
        orderBy: {
          name: "asc",
        },
      })
      .catch((e: any) => {
        logger.error(e);
      });

    // verify images is not void, and isn't empty
    if (images === undefined || images.length === 0) {
      return res.json({ images: [] });
    }

    // We only want to return the latest stable image for each name
    // if there are no stable images, we'll return the latest image

    let recommendedImages: any = [];

    let names: any = [];

    for (const image of images) {
      if (!names.includes(image.name)) {
        names.push(image.name);
      }
    }

    for (const name of names) {
      let latestImage = null;

      // find all the images with the same name
      const sortedImages = images.filter(
        (image: any) => image.name === name && image.url_trixie !== ""
      );

      for (const nameImage of sortedImages) {
        if (nameImage.name === name) {
          if (latestImage === null) {
            latestImage = nameImage;
          } else {
            if (nameImage.stable && !latestImage.stable) {
              latestImage = nameImage;
            } else if (nameImage.stable && latestImage.stable) {
              if (nameImage.modified_date > latestImage.modified_date) {
                latestImage = nameImage;
              }
            } else if (!nameImage.stable && !latestImage.stable) {
              if (nameImage.modified_date > latestImage.modified_date) {
                latestImage = nameImage;
              }
            }
          }
        }
      }

      if (latestImage) {
        recommendedImages.push(latestImage);
      }
    }

    return res.json({ images: recommendedImages });
  }
);

app.get("/api/v1/images/all/recommended", async (_req: any, res: any) => {
  let images = await prisma.images
    .findMany({
      orderBy: {
        name: "asc",
      },
    })
    .catch((e: any) => {
      logger.error(e);
    });

  // verify images is not void, and isn't empty
  if (images === undefined || images.length === 0) {
    return res.json({ images: [] });
  }

  // We only want to return the latest stable image for each name
  // if there are no stable images, we'll return the latest image

  let recommendedImages: any = [];

  let names: any = [];

  for (const image of images) {
    if (!names.includes(image.name)) {
      names.push(image.name);
    }
  }

  for (const name of names) {
    let latestImage = null;

    // find all the images with the same name
    const sortedImages = images.filter((image: any) => image.name === name);

    for (const nameImage of sortedImages) {
      if (nameImage.name === name) {
        if (latestImage === null) {
          latestImage = nameImage;
        } else {
          if (nameImage.stable && !latestImage.stable) {
            latestImage = nameImage;
          } else if (nameImage.stable && latestImage.stable) {
            if (nameImage.modified_date > latestImage.modified_date) {
              latestImage = nameImage;
            }
          } else if (!nameImage.stable && !latestImage.stable) {
            if (nameImage.modified_date > latestImage.modified_date) {
              latestImage = nameImage;
            }
          }
        }
      }
    }

    if (latestImage) {
      recommendedImages.push(latestImage);
    }
  }

  return res.json({ images: recommendedImages });
});

app.get(
  "/api/v1/images/byname/:name",
  async (req: any, res: { json: (arg0: { images: any }) => void }) => {
    let images = await prisma.images
      .findMany({
        where: {
          name: req.params.name,
        },
        orderBy: {
          name: "asc",
        },
      })
      .catch((e: any) => {
        logger.error(e);
      });

    return res.json({ images: images });
  }
);

app.get(
  "/api/v1/images/trixie/byname/:name/recommended",
  async (req: any, res: any) => {
    let images = await prisma.images
      .findMany({
        where: {
          name: req.params.name,
        },
        orderBy: {
          name: "asc",
        },
      })
      .catch((e: any) => {
        logger.error(e);
      });

    // verify images is not void, and isn't empty
    if (images === undefined || images.length === 0) {
      return res.json({ images: [] });
    }

    // We only want to return the latest stable image for each name
    // if there are no stable images, we'll return the latest image

    let recommendedImages: any = [];

    let latestImage = null;

    for (const image of images) {
      if (image.url_trixie === "") {
        continue;
      }

      if (latestImage === null) {
        latestImage = image;
      } else {
        if (image.stable && !latestImage.stable) {
          latestImage = image;
        } else if (image.stable && latestImage.stable) {
          if (image.modified_date > latestImage.modified_date) {
            latestImage = image;
          }
        } else if (!image.stable && !latestImage.stable) {
          if (image.modified_date > latestImage.modified_date) {
            latestImage = image;
          }
        }
      }
    }

    if (latestImage) {
      recommendedImages.push(latestImage);
    }

    return res.json({ images: recommendedImages });
  }
);

app.get(
  "/api/v1/images/byname/:name/recommended",
  async (req: any, res: any) => {
    let images = await prisma.images
      .findMany({
        where: {
          name: req.params.name,
        },
        orderBy: {
          name: "asc",
        },
      })
      .catch((e: any) => {
        logger.error(e);
      });

    // verify images is not void, and isn't empty
    if (images === undefined || images.length === 0) {
      return res.json({ images: [] });
    }

    // We only want to return the latest stable image for each name
    // if there are no stable images, we'll return the latest image

    let recommendedImages: any = [];

    let latestImage = null;

    for (const image of images) {
      if (latestImage === null) {
        latestImage = image;
      } else {
        if (image.stable && !latestImage.stable) {
          latestImage = image;
        } else if (image.stable && latestImage.stable) {
          if (image.modified_date > latestImage.modified_date) {
            latestImage = image;
          }
        } else if (!image.stable && !latestImage.stable) {
          if (image.modified_date > latestImage.modified_date) {
            latestImage = image;
          }
        }
      }
    }

    if (latestImage) {
      recommendedImages.push(latestImage);
    }

    return res.json({ images: recommendedImages });
  }
);

app.get(
  "/api/v1/images/byname/:name/stable",
  async (req: any, res: { json: (arg0: { images: any }) => void }) => {
    let images = await prisma.images
      .findMany({
        where: {
          name: req.params.name,
          stable: true,
        },
        orderBy: {
          name: "asc",
        },
      })
      .catch((e: any) => {
        logger.error(e);
      });

    return res.json({ images: images });
  }
);

// function to update the lastUpdated time
// Should run at first start of the server
// and then every 60 minutes

async function update_images(skip_wait = false) {
  if (!octokit) {
    logger.error("Octokit not initialized", { service: "Update Images" });
    setTimeout(update_images, 60 * 60 * 1000);
    return;
  }

  let last_updated_over_an_hour_ago = true;
  // see if there is a last updated time, and if so if the time is in the last 60 minutes
  // we'll skip the update if the last update was in the last 60 minutes

  if (!skip_wait) {
    await prisma.lastUpdated
      .findMany({
        take: 1,
        orderBy: {
          time: "desc",
        },
      })
      .then((lastUpdated: any) => {
        if (lastUpdated.length > 0) {
          const lastUpdatedTime = new Date(lastUpdated[0].time);
          const currentTime = new Date();
          // diff in hours
          const diff =
            (currentTime.getTime() - lastUpdatedTime.getTime()) / 1000 / 60;
          logger.info("Last updated " + Math.floor(diff) + " minutes ago", {
            service: "Update Images",
          });
          if (diff < 60) {
            logger.info(
              "Skipping update. Last updated less than 60 minutes ago. Rechecking in approximately " +
                Math.floor(60 - diff) +
                " minutes",
              { service: "Update Images" }
            );
            setTimeout(update_images, (60 - diff) * 60 * 1000);
            last_updated_over_an_hour_ago = false;
          }
        }
      })
      .catch((_e: any) => {
        logger.warn("No last updated time found", { service: "Update Images" });
      });
  }

  if (!last_updated_over_an_hour_ago) {
    return;
  }

  // replace the current lastUpdated with the current time
  await prisma.lastUpdated.deleteMany({}).catch((e: any) => {
    logger.error(e);
  });

  await prisma.lastUpdated.create({
    data: {
      time: new Date(),
    },
  });

  // show the rate limit
  const rateLimit = await octokit.request("GET /rate_limit");
  logger.info("Rate Limit " + rateLimit.data.resources.core.limit);

  let repos = await octokit.paginate("GET /orgs/{org}/repos", {
    org: "sdr-enthusiasts",
    type: "public",
    per_page: 100,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  for (const repo of repos) {
    if (IGNORED_REPOS !== undefined && IGNORED_REPOS.includes(repo.name)) {
      continue;
    }

    const data = await getPaginatedData(
      `/orgs/sdr-enthusiasts/packages/container/${repo.name}/versions`
    );

    if (data.length > 0) {
      /*  id    Int     @id @default(autoincrement())
          name  String
          url   String
          modified_date  DateTime @updatedAt
          created_date   DateTime @default(now())
          tag  String
          release_notes String
          stable Boolean
          is_pinned_version Boolean*/
      // search through the tags and find latest-build-*
      // if latest-build-* is found, we'll use that otherwise, we'll use latest
      let image_tag = "latest";
      let image_tag_trixie = "trixie-latest";
      let is_pinned_version = false;
      let found_trixie = false;

      for (const tag of data) {
        if (tag.startsWith("latest-build-")) {
          image_tag = tag;
          is_pinned_version = true;
          break;
        }
      }

      for (const tag of data) {
        if (tag.startsWith("trixie-latest-")) {
          image_tag_trixie = tag;
          found_trixie = true;
          break;
        }
      }

      let url_trixie = found_trixie
        ? `ghcr.io/sdr-enthusiasts/${repo.name}:${image_tag_trixie}`
        : "";
      let name = repo.name;
      let url = `ghcr.io/sdr-enthusiasts/${repo.name}:${image_tag}`;
      let modified_date = new Date(); // FIXME: we should get the modified date from the API
      let created_date = new Date();
      let release_notes = "No release notes available";
      let stable = true;

      // lets see if we already have this image in the database
      let existing_image = false;
      await prisma.images
        .findMany({
          where: {
            name: name,
            tag: image_tag,
            tag_trixie: found_trixie ? image_tag_trixie : "",
          },
        })
        .then((images: any) => {
          if (images.length > 0) {
            for (const image of images) {
              if (image.tag === image_tag) {
                existing_image = true;
              }
            }
          }
        })
        .catch((e: any) => {
          logger.error(e);
        });

      if (existing_image) {
        // if the existing image is not stable and the new image is stable
        // then we'll update the existing image
        // TODO: skip for now
        logger.debug("Skipping update for " + name + ":" + image_tag, {
          service: "Update Images",
        });
      } else {
        // if the image doesn't exist, we'll create it
        logger.info(`Creating ${name}:${image_tag}`, {
          service: "Update Images",
        });
        await prisma.images.create({
          data: {
            name: name,
            url: url,
            url_trixie: url_trixie,
            modified_date: modified_date,
            created_date: created_date,
            tag: image_tag,
            tag_trixie: image_tag_trixie,
            release_notes: release_notes,
            stable: stable,
            is_pinned_version: is_pinned_version,
          },
        });
      }
    }
  }

  logger.info("Done checking for updates", { service: "Update Images" });
  setTimeout(update_images, 60 * 60 * 1000);
}

async function getPaginatedData(url: String) {
  const nextPattern = /(?<=<)([\S]*)(?=>; rel="Next")/i;
  let pagesRemaining = true;
  let data: any = [];
  let continue_getting_data = true;

  while (pagesRemaining) {
    const response = await octokit
      .request(`GET ${url}`, {
        per_page: 100,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      })
      .catch((_e: any) => {
        logger.info(`No packages for ${url}`);
        continue_getting_data = false;
      });

    if (!continue_getting_data) {
      return data;
    }

    const parsedData = parseData(response.data);
    // go through the parsed data and only keep any that have metadata.container.tags
    for (const element of parsedData) {
      if (element.metadata.container.tags) {
        // go through the tags and see if any of them are the latest
        let latest = false;
        for (const tag of element.metadata.container.tags) {
          if (tag === "latest" || tag === "trixie-latest") {
            latest = true;
          }
        }
        // if latest is found, we'll only keep that tag
        if (latest) data.push(...element.metadata.container.tags);
      }
    }

    if (parsedData.length >= 1) {
      continue_getting_data = false;
    }

    const linkHeader = response.headers.link;

    pagesRemaining = linkHeader && linkHeader.includes(`rel=\"next\"`);

    if (pagesRemaining && continue_getting_data) {
      url = linkHeader.match(nextPattern)[0];
    } else {
      pagesRemaining = false;
    }
  }

  return data;
}

function parseData(data: any) {
  // If the data is an array, return that
  if (Array.isArray(data)) {
    return data;
  }

  // Some endpoints respond with 204 No Content instead of empty array
  //   when there is no data. In that case, return an empty array.
  if (!data) {
    return [];
  }

  // Otherwise, the array of items that we want is in an object
  // Delete keys that don't include the array of items
  delete data.incomplete_results;
  delete data.repository_selection;
  delete data.total_count;
  // Pull out the array of items
  const namespaceKey = Object.keys(data)[0];
  data = data[namespaceKey];

  return data;
}

async function main() {
  octokit = await octo_app.getInstallationOctokit(46970787);
  logger.info("Logger level set to " + logger.level);
  app.listen(port, () => {
    //logger.info(`Listening to requests on port ${port}`);
  });
  await update_images(true);
  while (true) {
    // keep the program running
    const sleep = util.promisify(setTimeout);
    await sleep(100000);
  }
}

main()
  .then(async () => {
    exit();
  })
  .catch(async (e) => {
    logger.error(`Error in main: ${e}`);
    await prisma.$disconnect();
    process.exit(1);
  });

process.on("SIGINT", () => exit()); // CTRL+C
process.on("SIGQUIT", () => exit()); // Keyboard quit
process.on("SIGTERM", () => exit()); // `kill` command

async function exit() {
  await prisma.$disconnect().catch((e: any) => {
    logger.error(e);
    process.exit(1);
  });
  logger.info("Exiting");
  process.exit(0);
}
