# SDR-E Image API

## Introduction

This is an API to query the latest image versions. To run it, you will need a private key. Maybe, eventually, I'll have a public endpoint for people to use. For now, this is mostly for internal use.

## End Points

| Endpoint                                   | Description                                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/last-updated`                     | Returns the last time the API updated                                                                                       |
| `/api/v1/images/all`                       | Returns all images                                                                                                          |
| `/api/v1/images/all/stable`                | Returns all stable images                                                                                                   |
| `/api/v1/images/all/recommended`           | Returns all recommended images. Either will be the latest stable tagged version, or if there is no tagged version, `latest` |
| `/api/v1/images/byname/<name>`             | Returns all images with the name `<name>`                                                                                   |
| `/api/v1/images/byname/<name>/recommended` | Returns all recommended images with the name `<name>`                                                                       |
| `/api/v1/images/byname/<name>/stable`      | Returns all stable images with the name `<name>`                                                                            |

## Nomenclature

`stable` - An image that has been designated as stable.
`recommended` - An image that is either the latest stable tagged version, or if there is no tagged version, `latest`.

## Limitations

- The API is not public. You will need a private key to run it.
- Currently, all tagged images when the API detects a change will get marked as `stable`. In the future there will be a way to designate a specific image as `stable`.

## TODO

- [ ] Create a web interface for the API
  - [ ] Allow designation of stable images
  - [ ] Show open PRs and issues for SDR-E
