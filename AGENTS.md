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
- Lint check JavaScript (if JavaScript was altered)
```bash
npm init @eslint/config@latest
```
- Lint check CSS (if CSS was altered)
  ```bash
  npm install @eslint/css -D
  ```
  and then
  ```bash
  import css from "@eslint/css";

    export default [
        // lint css files
        {
            files: ["**/*.css"],
            plugins: {
                css,
            },
            language: "css/css",
            rules: {
                "css/no-duplicate-imports": "error",
            },
        },
    ];
  ```

## Commit Guidelines
- Write concise, descriptive commit messages.
- Do **not** amend or squash existing commits.

## Pull Request Guidelines
- Summarize your changes clearly in the PR description.
- Ensure Prettier has been run on all modified files.
