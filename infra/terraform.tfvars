# Non-secret settings for this deployment. Secrets are environment variables in CI.
# Replace every CHANGE-ME here and the state key in versions.tf (see infra/README.md).
project_name        = "meal-planner"     # base name for Vercel, Neon and Sentry projects
github_owner        = "jrubins"          # GitHub user or organization
github_repository   = "meal-planner"     # this repository's name
vercel_team_id      = "team_VmOKVE4X5FKT5sJdDW2iuEvL" # "Jon Rubins' projects" (personal)
sentry_organization = "CHANGE-ME"        # Sentry organization slug
workos_client_id    = "client_CHANGE-ME" # WorkOS: Developer > API Keys
authkit_domain      = "https://CHANGE-ME.authkit.app"
# Once you've both signed in, add both WorkOS user IDs to lock the app to the two of you:
allowed_user_ids = []
