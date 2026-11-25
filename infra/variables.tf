variable "project_name" {
  description = "Base name for the Vercel, Neon and Sentry projects (e.g. my-app)."
  type        = string
}

# --- GitHub ---

variable "github_owner" {
  description = "GitHub user or organization that owns the repository."
  type        = string
}

variable "github_repository" {
  description = "Repository name (without the owner). Changing it renames the repository."
  type        = string
}

variable "github_visibility" {
  description = "Repository visibility: public or private."
  type        = string
  default     = "public"
}

variable "production_branch" {
  description = "Branch that deploys to production and is protected. Must already exist."
  type        = string
  default     = "main"
}

variable "required_status_checks" {
  description = "CI job names that must pass before a pull request can merge."
  type        = list(string)
  default     = ["check", "zizmor"]
}

# --- Vercel ---

variable "vercel_team_id" {
  description = "Vercel team ID (team_...). Null for a personal (Hobby) account."
  type        = string
  default     = null
}

variable "vercel_function_region" {
  description = "Region for the API function; keep it next to the database (iad1 = us-east-1)."
  type        = string
  default     = "iad1"
}

variable "web_url" {
  description = "Public URL of the web app. Null: https://<project_name>-web.vercel.app."
  type        = string
  default     = null
}

variable "api_url" {
  description = "Public URL of the API. Null: https://<project_name>-api.vercel.app."
  type        = string
  default     = null
}

# --- Neon ---

variable "neon_org_id" {
  description = "Neon organization ID (org-...). Null: the API key's default organization."
  type        = string
  default     = null
}

variable "neon_region" {
  description = "Neon region; keep it next to the API function."
  type        = string
  default     = "aws-us-east-1"
}

variable "neon_pg_version" {
  description = "Postgres major version."
  type        = number
  default     = 19
}

variable "neon_history_retention_seconds" {
  description = "Point-in-time restore window. The Free plan allows at most 6 hours."
  type        = number
  default     = 21600
}

variable "neon_max_cu" {
  description = "Autoscaling ceiling in compute units."
  type        = number
  default     = 1
}

variable "database_url_version" {
  description = "Bump to send DATABASE_URL to Vercel again (e.g. after resetting the role's password)."
  type        = number
  default     = 1
}

# --- Sentry ---

variable "sentry_organization" {
  description = "Sentry organization slug."
  type        = string
}

variable "sentry_traces_sample_rate" {
  description = "Share of requests and page loads traced in production."
  type        = number
  default     = 0.1
}

variable "sentry_sourcemaps_token" {
  description = "Sentry auth token for uploading the web app's source maps during Vercel builds. Never stored in state."
  type        = string
  default     = null
  sensitive   = true
  ephemeral   = true
}

variable "sentry_sourcemaps_token_version" {
  description = "0: no source map upload. Set to 1 (and bump on rotation) to send sentry_sourcemaps_token to Vercel."
  type        = number
  default     = 0
}

# --- App ---

variable "workos_client_id" {
  description = "WorkOS client ID (client_...). Not a secret."
  type        = string
}

variable "authkit_domain" {
  description = "AuthKit domain, e.g. https://your-app.authkit.app."
  type        = string
}

variable "workos_api_key" {
  description = "WorkOS API key (sk_...) for server-side sign-in. From the WORKOS_API_KEY Actions secret; never stored in state."
  type        = string
  sensitive   = true
  ephemeral   = true

  validation {
    condition     = startswith(var.workos_api_key, "sk_")
    error_message = "Set the WORKOS_API_KEY Actions secret to your WorkOS API key (sk_...)."
  }
}

variable "workos_api_key_version" {
  description = "Bump to send a rotated WORKOS_API_KEY to Vercel."
  type        = number
  default     = 1
}

variable "ai_provider" {
  description = "AI provider that reads recipe photos (TanStack AI adapter): anthropic, openai or gemini."
  type        = string
  default     = "anthropic"

  validation {
    condition     = contains(["anthropic", "openai", "gemini"], var.ai_provider)
    error_message = "ai_provider must be anthropic, openai or gemini."
  }
}

variable "ai_model" {
  description = "The provider's model. Null: the default (claude-opus-5-5 for anthropic); required for openai and gemini."
  type        = string
  default     = null
}

variable "ai_api_key" {
  description = "API key of the AI provider. From the AI_API_KEY Actions secret; never stored in state."
  type        = string
  default     = null
  sensitive   = true
  ephemeral   = true

  validation {
    condition     = var.ai_api_key_version == 0 || coalesce(var.ai_api_key, "") != ""
    error_message = "ai_api_key_version is set: add the AI_API_KEY Actions secret (the provider's API key), or set the version to 0."
  }
}

variable "ai_api_key_version" {
  description = "0: recipe photos aren't read. Set to 1 (and bump on rotation or provider change) to send ai_api_key to Vercel."
  type        = number
  default     = 0
}

variable "image_provider" {
  description = "AI provider that makes meal pictures (TanStack AI adapter): openai or gemini."
  type        = string
  default     = "openai"

  validation {
    condition     = contains(["openai", "gemini"], var.image_provider)
    error_message = "image_provider must be openai or gemini."
  }
}

variable "image_model" {
  description = "The provider's image model. Null: the default (gpt-image-2.5-flare for openai, gemini-3.1-flash-lite-image for gemini)."
  type        = string
  default     = null
}

variable "image_quality" {
  description = "OpenAI image quality: low, medium or high. Cost per picture rises with it."
  type        = string
  default     = "low"

  validation {
    condition     = contains(["low", "medium", "high"], var.image_quality)
    error_message = "image_quality must be low, medium or high."
  }
}

variable "image_api_key" {
  description = "API key of the image provider. From the IMAGE_API_KEY Actions secret; never stored in state."
  type        = string
  default     = null
  sensitive   = true
  ephemeral   = true

  validation {
    condition     = var.image_api_key_version == 0 || coalesce(var.image_api_key, "") != ""
    error_message = "image_api_key_version is set: add the IMAGE_API_KEY Actions secret (the image provider's API key), or set the version to 0."
  }
}

variable "image_api_key_version" {
  description = "0: meals can't get generated pictures. Set to 1 (and bump on rotation or provider change) to send image_api_key to Vercel."
  type        = number
  default     = 0
}

variable "cookie_password_version" {
  description = "Bump to generate a new session cookie password. Signs everyone out."
  type        = number
  default     = 1
}

variable "allowed_user_ids" {
  description = "WorkOS user IDs (user_...) allowed to use the app. Empty: anyone who can sign in."
  type        = list(string)
  default     = []
}
