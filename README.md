# CreatePullRequestAction

This action creates a pull request based on the parameters you use.

## Inputs
### `repo-token`
[**Required**] Github token used to make API calls. Must have at least admin:org:read

### `title`
[**Required**] Title of the pull request

### `base`
[**Required**] Name of the destination branch

### `branch`
[**Required**] Name of the source branch

### `team-reviewers`
List of comma-separated names of teams. All users contained in these teams will be individually asked for a review

### `user-reviewers`
List of comma-separated logins of users

### `labels`
List of comma-separated label names. If one does not exist, it will be created

## How to update ?
- Install `vercel/ncc` by running this command in your terminal. 
```
npm i -g @vercel/ncc
```
- Compile your index.js file. 
```
ncc build index.js --license licenses.txt
```

Official documentation can be found [here](https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action#commit-tag-and-push-your-action-to-github)