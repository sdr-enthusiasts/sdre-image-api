// Copyright (c) 2024 Fred Clausen
//
// Licensed under the MIT license: https://opensource.org/licenses/MIT
// Permission is granted to use, copy, modify, and redistribute the work.
// Full license information available in the project LICENSE file.

const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req: any, res: { json: (arg0: { message: string }) => void }) => {
  res.json({ message: "alive" });
});

app.listen(port, () => {
  console.log(`Listening to requests on port ${port}`);
});
