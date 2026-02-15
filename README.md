# SpartanAuth Login Widget

This is a fully functional widget, designed to use [SpartanAuth as the backend](https://www.spartanauth.com) for all the authentication endpoints. you can add to any of your frontend applications. It is packaged as a web-component and can be used in any modern browser.

## Usage

### Include in your application

```bash
$ npm install @spartanauth/login-widget # or pnpm add @spartanauth/login-widget or yarn add @spartanauth/login-widget
```

Alternatively, you can use the CDN:

```html
<link rel="stylesheet" href="https://cdn.spartanauth.com/login-widget/1.0.0/login-widget.js">
```

Then include the widget in your application's HTML:

```html
<spartan-login start-mode="webAuthn" locale="en"></spartan-login>
```

### Invite Widget

For completing user invitations, use the invite widget:

```html
<spartan-invite 
  domain="https://auth.yourdomain.com" 
  sector="your-sector-id" 
  sub="user-sub-from-invite" 
  email="user@example.com"
  locale="en"
  redirect="/app">
</spartan-invite>
```

The invite widget can also read `sub` and `email` from URL parameters if not provided as props:

```html
<!-- URL: /complete-invite?sub=abc123&email=user@example.com -->
<spartan-invite 
  domain="https://auth.yourdomain.com" 
  sector="your-sector-id"
  redirect="/login">
</spartan-invite>
```

### Configure the widget

TODO: Add the configuration information here.

## Contributing

### Available Scripts

In the project directory, you can run:

```bash
npm dev
# or
npm start
```

Runs the widget in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>

### `npm run build`

Builds the widget for production to the `dist` folder.<br>
It correctly bundles the Login Widget in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
The login widget is ready to be deployed!

## Deployment

You can deploy the `dist` folder to any static host provider (netlify, surge, now, etc.)
