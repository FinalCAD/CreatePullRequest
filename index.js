const core = require('@actions/core');
const github = require('@actions/github');

const githubToken = core.getInput('repo-token');
const ghClient = new github.getOctokit(githubToken);

async function createLabels(repo, labels) {
  let createdLabelIds = [];
  for (let label of labels) {
    let result = await ghClient.graphql(`
    mutation CreateLabels {
      createLabel(
        input: {repositoryId: "${repo}", name: "${label}", color: "1D76DB"})
        {
          clientMutationId,
          label {
            id
          }
        }
    }`, 
    {
      headers: {
        accept: `application/vnd.github.bane-preview+json`
      }
    });
    createdLabelIds.push(result.createLabel.label.id);
  }
  return createdLabelIds;
}

async function getRepoAndLabels(owner, repo, labelsSought) {
  let result = await ghClient.graphql(`{
    repository(name: "${repo}", owner: "${owner}") {
        id
        labels(first: 100) {
          nodes {
            id
            name
          }
        }
      }
    }`, {});
  let repoId = result.repository.id;
  let labels = result.repository.labels.nodes;
  labelIds = [];
  missingLabels = [];
  for (const labelSought of labelsSought) {
    var labelFound = labels.find(l => l.name.toUpperCase() === labelSought.toUpperCase());
    if (labelFound !== undefined)
      labelIds.push(labelFound.id);
    else
      missingLabels.push(labelSought);
  }
  if (missingLabels.length > 0) {
    let labelsCreated = await createLabels(repoId, missingLabels);
    labelsCreated.forEach(x => labelIds.push(x));
  }
    
  return { repoId, labelIds };
}

async function getMembers(owner, teams, users) {
  let userIds = [];
  for (let team of teams) {
    let result = await ghClient.graphql(`{
        organization(login: "${owner}") {
          team(slug: "${team}") {
            members {
              nodes {
                id,
                login
              }
            }
          }
        }
      }`, {});
      result.organization.team.members.nodes.forEach(member => userIds.push(member.id));
  }

  let members = await ghClient.graphql(`{
    organization(login: "${owner}") {
      membersWithRole(first: 100) {
        nodes {
          id,
          login
        }
      }
    }
  }`, {});
  for (const member of members.organization.membersWithRole.nodes) {
    var login = member.login;
    if (users.some(u => login.toUpperCase() == u.toUpperCase())) {
      userIds.push(member.id);
    }
  }
  return userIds;
}

async function markReadyToReview(currentPullRequestId) {
  await ghClient.graphql(`
  mutation MarkReadyToReview {
    markPullRequestReadyForReview(input: {pullRequestId: "${currentPullRequestId}"}) {
      clientMutationId
    }
  }`, {});
}

async function personnalizePullRequest(currentPullRequestId, labelIds, userIds) {
  await ghClient.graphql(`
  mutation PersonnalizePullRequest {
    addLabelsToLabelable(
      input: {labelableId: "${currentPullRequestId}", labelIds: ${JSON.stringify(labelIds)}})
      {
        clientMutationId
      }
    requestReviews(input: {pullRequestId: "${currentPullRequestId}", userIds: ${JSON.stringify(userIds)}})
    {
      clientMutationId
    }
  }`, {});
}

async function createPullRequest(repoId, base, branch, title, reviewers, labels) {
  let continueFlow = true;
  let result = await ghClient.graphql(`
  mutation CreatePullRequest {
    createPullRequest(
      input: {repositoryId: "${repoId}", baseRefName: "${base}", headRefName: "${branch}", title: "${title}", draft: true}) 
      {
        pullRequest {
          id
      }
      clientMutationId
    }
  }`, {})
  .catch((error) => {
    if (error.errors[0].message.startsWith("A pull request already exists")) {
      continueFlow = false;
      console.warn("Pull requests already exists. Do nothing.")
    }
    else {
      throw error;
    }
  });

  if (continueFlow) {
    await personnalizePullRequest(result.createPullRequest.pullRequest.id, labels, reviewers);
    await markReadyToReview(result.createPullRequest.pullRequest.id);
  }
}

async function run() {
  const context = await github.context;
  let repoInfo = core.getInput('repo');
  let owner = repoInfo.split('/')[0];
  let repo = repoInfo.split('/')[1];
  let title = core.getInput('title');
  let teamReviewers = core.getInput('team-reviewers').split(',');
  let userReviewers = core.getInput('user-reviewers').split(',');
  let baseBranch = core.getInput('base');
  let sourceBranch = core.getInput('branch');
  let labels = core.getInput('labels').split(',');

  var result = await getRepoAndLabels(owner, repo, labels);
  var reviewerIds = await getMembers(owner, teamReviewers, userReviewers);;
  await createPullRequest(result.repoId, baseBranch, sourceBranch, title, reviewerIds, result.labelIds);
}

try {
    run();
} catch (error) {
    core.setFailed(error.message);
}