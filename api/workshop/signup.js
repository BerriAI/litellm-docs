let handler;
module.exports = async (req, res) => {
  handler ||= import('../../workshop/signup.mjs').then(({createWorkshopSignupHandler}) => createWorkshopSignupHandler());
  return (await handler)(req, res);
};
