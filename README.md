# Asset Vault

Asset Vault is a serverless, static web application that serves as your personal digital asset and theme repository dashboard. It runs 100% on GitHub Pages and uses the GitHub API as its backend to store and serve files directly from your repository.

## 🚀 Deployment Instructions

### 1. Create a GitHub Repository
1. Go to your GitHub account and create a new **public** (or private) repository, for example, named `asset-vault`.
2. Upload all the files from this folder (`index.html`, `styles.css`, `app.js`, and `README.md`) to the root of your repository.
3. Commit and push the files to the `main` branch.

### 2. Enable GitHub Pages
1. In your GitHub repository, navigate to **Settings** > **Pages**.
2. Under **Build and deployment**, set the Source to **Deploy from a branch**.
3. Select the `main` branch and the `/ (root)` folder.
4. Click **Save**. Your Asset Vault will be live at `https://<your-username>.github.io/<your-repo-name>/` shortly.

### 3. Generate a GitHub Personal Access Token (PAT)
To allow the application to upload files and update the internal database securely from your browser:
1. Go to your GitHub **Settings** > **Developer Settings** > **Personal access tokens** > **Tokens (classic)**.
2. Click **Generate new token (classic)**.
3. Give it a note (e.g., "Asset Vault API").
4. Under **Select scopes**, check the box for **`repo`** (Full control of private repositories).
5. Generate the token and **copy it immediately**. Keep it safe!

### 4. Configure Your Web App
1. Navigate to your deployed GitHub Pages URL (e.g., `https://your-username.github.io/asset-vault/`).
2. A **Settings Modal** will open automatically.
3. Enter your:
   * **GitHub PAT** (the token you generated).
   * **Repository name** in the format `owner/repo` (e.g., `mbm/asset-vault`).
   * **Branch** (usually `main`).
4. Click **Save Settings**. 

Now you can start uploading assets directly from your browser UI!

## ⚠️ Important Notes on File Uploads
Because this static application converts uploaded files (like .zip and .rar) into Base64 strings directly in your web browser before sending them to GitHub, please avoid uploading extremely large files (larger than 50MB). Doing so might crash your browser tab due to high memory usage or hit GitHub's API rate limits. For files larger than 50MB, upload them manually through the GitHub web interface or Git CLI.

## 🛠 Tech Stack
* HTML5
* CSS3 (Custom Properties for Theming)
* Vanilla JavaScript (ES6+)
* GitHub REST API v3
