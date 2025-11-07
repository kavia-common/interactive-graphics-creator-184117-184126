# Lightweight React Template for KAVIA

This project provides a minimal React template with a clean, modern UI and minimal dependencies.

## New Feature: Photo Upload Canvas

- Upload one or more images (PNG/JPG/JPEG) via the "Upload Images" button or drag-and-drop into the workspace.
- Click an image to select it and drag to reposition it within the canvas area.
- Use the "Clear Canvas" button to remove all images.
- Styling follows the "Ocean Professional" theme.

### How to run

In the project directory, you can run:

- `npm start` — Runs the app in development mode.
  - Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Notes

- This is a client-only implementation; no backend is required.
- Images are displayed using object URLs which are revoked when clearing the canvas.

## Getting Started (template)

The rest of the template documentation applies as before.

### `npm test`

Launches the test runner in interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

## Customization

### Colors (Ocean Professional)

The main brand colors are defined as CSS variables in `src/App.css`:

```css
:root {
  --primary: #2563EB;
  --secondary: #F59E0B;
  --background: #f9fafb;
  --surface: #ffffff;
  --text: #111827;
}
```

### Components

This template uses pure HTML/CSS components instead of a UI framework. You can find component styles in `src/App.css`. 

Common components include:
- Buttons
- Container
- Navigation
- Typography

## Learn More

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
