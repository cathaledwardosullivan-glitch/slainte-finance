const { app } = require('electron');
console.log('app:', app);
console.log('app.getPath:', app?.getPath);
app.whenReady().then(() => {
  console.log('App is ready!');
  app.quit();
});
