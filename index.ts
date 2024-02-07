// Copyright (c) 2024 Fred Clausen
//
// Licensed under the MIT license: https://opensource.org/licenses/MIT
// Permission is granted to use, copy, modify, and redistribute the work.
// Full license information available in the project LICENSE file.

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { Octokit, App } = require("octokit");
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

app.get(
  "/api/last-updated",
  async (req: any, res: { json: (arg0: { lastUpdated: any }) => void }) => {
    const lastUpdated = await prisma.lastUpdated.findMany({
      take: 1,
      orderBy: {
        time: "desc",
      },
    });
    // verify that the lastUpdated is not empty
    if (lastUpdated.length === 0) {
      return res.json({ lastUpdated: null });
    }

    res.json({ lastUpdated: lastUpdated[0].time });
  }
);

app.listen(port, () => {
  console.log(`Listening to requests on port ${port}`);
});

// function to update the lastUpdated time
// Should run at first start of the server
// and then every 60 minutes

async function update_images() {
  if (!octokit) {
    console.error("Octokit not initialized");
    setTimeout(update_images, 60 * 60 * 1000);
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
  console.log("Rate Limit " + rateLimit.data.resources.core.limit);

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
      console.log(`Updating ${repo.name} with ${data} images`);
    }
  }

  console.log("Done");
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
        console.log(`No packages for ${url}`);
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
  await update_images();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

//export {};
