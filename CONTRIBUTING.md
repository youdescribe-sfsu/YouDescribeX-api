# Contributing

## Branch And Merge Flow

1. Do all implementation work on your own personal branch.
2. Before any merge happens, Sanjay must complete code review.
3. After Sanjay approves, merge the change into `dev`.
4. Once the code is in `dev`, the whole team tests it together. This testing step is shared by everyone, including the original author.
5. Only after the `dev` branch has been tested thoroughly and looks good should the change be merged into `main`.

## CI/CD Expectations

- Personal branches run validation only. They should not deploy.
- The `dev` branch is the shared integration branch for team testing.
- The `main` branch is production-only and should receive code only after `dev` testing is complete.

## Review Policy

The CI pipeline can validate branches and deployments, but reviewer identity enforcement must be configured in GitLab project settings.
Set merge request approvals so Sanjay must approve before merges into `dev` or `main`.
