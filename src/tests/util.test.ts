const mongoose = require('mongoose');

function calculateContributions(contributions, origin, user, revision) {
  const edittingDistance = calculateEdittingDistance(origin, revision);
  console.log('editing distance: ', edittingDistance);
  const oldLength = origin.length;
  const newContribution = edittingDistance / (oldLength + edittingDistance);
  console.log('new contribution: ', newContribution);
  const oldContributionSum = 1 - newContribution;
  console.log('old contribution sum: ', oldContributionSum);

  let userFound = false;
  contributions.forEach((value, key) => {
    contributions.set(key, value * oldContributionSum);
    if (key === user) {
      userFound = true;
    }
  });

  if (!userFound) {
    contributions.set(user, newContribution);
  }
}

function calculateEdittingDistance(origin, revision) {
  const m = origin.length;
  const n = revision.length;
  const dp = new Array(m + 1).fill(0).map(() => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      if (i === 0) {
        dp[i][j] = j;
      } else if (j === 0) {
        dp[i][j] = i;
      } else if (origin[i - 1] === revision[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
      }
    }
  }

  return dp[m][n];
}

// Set three users with contributions added up to 1
const initContributions = () => {
  const contributions = new Map();
  const user1 = '65a41f62ca7ea39009340475';
  const user2 = '65a41f62ca7ea39009340476';
  const user3 = '65a41f62ca7ea39009340477';
  contributions.set(user1, 0.8);
  contributions.set(user2, 0.1);
  contributions.set(user3, 0.1);
  return contributions;
};

// Test calculateContributions
function test1() {
  const contributions = initContributions();
  const user4 = '65a41f62ca7ea39009340478';
  calculateContributions(contributions, 'origin', user4, 'revision');
  // Iterate the modified contributions
  contributions.forEach((value, key) => {
    console.log(key, value);
  });
}

test1();
