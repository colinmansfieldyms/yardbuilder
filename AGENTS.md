# AGENTS.md

These instructions apply to all files in this repository.

## Formatting
- Use **2 spaces** for indentation in HTML, CSS, and JavaScript.
- Run [Prettier](https://prettier.io/) before committing:
  ```bash
  npx prettier -w index.html script.js style.css
  ```
  For a quick check, you can run:
  ```bash
  npx prettier -c index.html script.js style.css
  ```
## Testing
- Lint JavaScript: npx eslint script.js
- Validate HTML:
  ```bash
  npx htmlhint index.html
  ```
- Check CSS:
  ```bash
  npx stylelint style.css
  ```
- Optionally, run a headless browser test (e.g., Playwright or Cypress) to validate basic UI interactions.

## Commit Guidelines
- Write concise, descriptive commit messages.
- Do **not** amend or squash existing commits.

## Pull Request Guidelines
- Summarize your changes clearly in the PR description.
- Ensure Prettier has been run on all modified files.
