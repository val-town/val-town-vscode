# Val Town - VS Code Integration

Use Val Town from the comfort of VS Code.

## Setup

Use the `Val Town: Set Token` command to set your api token, that you can get from the [Val Town Website](https://www.val.town/settings/api).

## Features

### Author Vals from VS Code

![val demo](https://raw.githubusercontent.com/val-town/val-town-vscode/main/img/vals.png)

## Preview Web Endpoints

![preview demo](https://raw.githubusercontent.com/val-town/val-town-vscode/main/img/preview.png)

### Edit/Manage your Blobs

![blob demo](https://raw.githubusercontent.com/val-town/val-town-vscode/main/img/blobs.png)

### Run SQLite Queries

![sqlite demo](https://raw.githubusercontent.com/val-town/val-town-vscode/main/img/sqlite.png)

### Quick Import Vals

![autocomplete demo](https://raw.githubusercontent.com/val-town/val-town-vscode/main/img/autocomplete.png)

## Sidebar Configuration

You can configure the sidebar val tree by editing the `valtown.tree` entry in your settings.

```jsonc
{
  "valtown.tree": [
    // Add a val to your sidebar
    "@stevekrouse/fetchJSON",
    // You can also pass an api endpoint, that must a paginated list of vals
    {
      "title": "Liked Vals",
      "icon": "heart",
      "path": "https://api.val.town/api/v1/me/likes"
    },
    // Some vars are available to use in the url
    {
      "title": "My Vals",
      "icon": "home",
      "path": "https://api.val.town/api/v1/users/${user:me}/vals" // user:me is the current id
    },
    {
      "title": "Standard Library",
      "icon": "book",
      "path": "https://api.val.town/api/v1/users/${user:stevekrouse}/vals" // user:<username> is the id of the user with that username
    },
    // You can also nest items
    {
      "title": "Pinned Vals",
      "icon": "pin",
      "items": [
        "@std/blob",
        "@std/sqlite",
      ]
    },
    {
      "title": "Tags",
      "icon": "tag",
      "items": [
        // The search endpoint also returns a paginated list of vals!
        {
          "title": "#vscode",
          "icon": "tag",
          "path": "https://api.val.town/api/v1/users/search?query=${encodeURIComponent:#vscode}"
        },
        {
          "title": "#blob",
          "icon": "blog",
          "path": "https://api.val.town/api/v1/users/search?query=${encodeURIComponent:#blog}"
        },
      ]
    },

  ]
}
```

A list of all the available icons can be found [here](https://code.visualstudio.com/api/references/icons-in-labels#icon-listing).
