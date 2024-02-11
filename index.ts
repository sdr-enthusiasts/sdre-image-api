// Copyright (c) 2024 Fred Clausen
//
// Licensed under the MIT license: https://opensource.org/licenses/MIT
// Permission is granted to use, copy, modify, and redistribute the work.
// Full license information available in the project LICENSE file.

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { Octokit, App } = require("octokit");
const winston = require("winston");
const app = express();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();
const octo_app = new App({
  appId: process.env.APP_ID,
  privateKey: require("fs").readFileSync(process.env.API_KEY).toString(),
});

let octokit: any = null;

const IGNORED_REPOS = [
  "sdre-bias-t-common",
  "sdr-e-base-repo-setup",
  "S6-v3-Examples",
  "acars-bridge",
  "install-libsdrplay",
  "sdre-rust-adsb-parser",
  "sdre-stubborn-io",
  "FlightAirMap",
  "sdre-rust-logging",
  "adsb_parser",
  "docker-ais-dispatcher",
  "docker-shipxplorer",
  "readsb-router",
  "docker-virtualradarserver",
  "sdr-enthusiast-assets",
  "docker-baseimage",
  "docker-ModeSMixer2",
  "gitbook-adsb-guide",
  "plane-alert-db",
  "docker-acarshub-baseimage",
  "Buster-Docker-Fixes",
  "docker-install",
  "docker-jaero",
  "rbfeeder",
];

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
  level: "info",
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

if (process.env.NODE_ENV !== "production") {
  logger.level = "debug";
}

if (process.env.LOG_LEVEL) {
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
  }
}

app.get(
  "/api/last-updated",
  async (req: any, res: { json: (arg0: { lastUpdated: any }) => void }) => {
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
        logger.error(e, { service: "SDR API /api/last-updated" });
      });

    return res.json({ lastUpdated: lastUpdatedOutput || "never" });
  }
);

app.get(
  "/api/images/all",
  async (req_: any, res: { json: (arg0: { images: any }) => void }) => {
    let images = await prisma.Images.findMany({
      orderBy: {
        name: "asc",
      },
    }).catch((e: any) => {
      logger.error(e);
    });

    return res.json({ images: images });
  }
);

app.get(
  "/api/images/byname/:name",
  async (req: any, res: { json: (arg0: { images: any }) => void }) => {
    let images = await prisma.Images.findMany({
      where: {
        name: req.params.name,
      },
      orderBy: {
        name: "asc",
      },
    }).catch((e: any) => {
      logger.error(e);
    });

    return res.json({ images: images });
  }
);

app.get(
  "/api/images/all/stable",
  async (req: any, res: { json: (arg0: { images: any }) => void }) => {
    let images = await prisma.Images.findMany({
      where: {
        stable: true,
      },
      orderBy: {
        name: "asc",
      },
    }).catch((e: any) => {
      logger.error(e);
    });

    return res.json({ images: images });
  }
);

app.get(
  "/api/images/byname/:name/stable",
  async (req: any, res: { json: (arg0: { images: any }) => void }) => {
    let images = await prisma.Images.findMany({
      where: {
        name: req.params.name,
        stable: true,
      },
      orderBy: {
        name: "asc",
      },
    }).catch((e: any) => {
      logger.error(e);
    });

    return res.json({ images: images });
  }
);
// function to update the lastUpdated time
// Should run at first start of the server
// and then every 60 minutes

async function update_images() {
  if (!octokit) {
    logger.error("Octokit not initialized", { service: "Update Images" });
    setTimeout(update_images, 60 * 60 * 1000);
    return;
  }

  let last_updated_over_an_hour_ago = true;
  // see if there is a last updated time, and if so if the time is in the last 60 minutes
  // we'll skip the update if the last update was in the last 60 minutes
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
            "Skipping update. Last updated less than 60 minutes ago. Rechecking in approxmiately " +
              Math.floor(60 - diff) +
              " minutes",
            { service: "Update Images" }
          );
          setTimeout(update_images, (60 - diff) * 60 * 1000);
          last_updated_over_an_hour_ago = false;
        }
      }
    });

  if (!last_updated_over_an_hour_ago) {
    return;
  }

  // replace the current lastUpdated with the current time
  await prisma.lastUpdated.deleteMany({});
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
    if (IGNORED_REPOS.includes(repo.name)) {
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
      let is_pinned_version = false;
      for (const tag of data) {
        if (tag.includes("latest-build-")) {
          image_tag = tag;
          is_pinned_version = true;
          break;
        }
      }

      let name = repo.name;
      let url = `ghcr.io/sdr-enthusiasts/${repo.name}:${image_tag}`;
      let modified_date = new Date(); // FIXME: we should get the modified date from the API
      let created_date = new Date();
      let release_notes = "No release notes available";
      let stable = false;

      // lets see if we already have this image in the database
      let existing_image = false;
      await prisma.Images.findMany({
        where: {
          name: name,
          tag: image_tag,
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
        await prisma.Images.create({
          data: {
            name: name,
            url: url,
            modified_date: modified_date,
            created_date: created_date,
            tag: image_tag,
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
      .catch((e_: any) => {
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
          if (tag === "latest") {
            latest = true;
          }
        }

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
    logger.info(`Listening to requests on port ${port}`);
  });
  await update_images();

  const sleep = require("util").promisify(setTimeout);
  while (true) {
    // keep the program running
    await sleep(100000);
  }
}

main()
  .then(async () => {
    exit();
  })
  .catch(async (e) => {
    logger.error(e);
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
