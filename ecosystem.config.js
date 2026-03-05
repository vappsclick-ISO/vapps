module.exports = {
    apps: [
      {
        name: "vapps",
        script: "npm",
        args: "start",
        env: {
          NODE_ENV: "production",
          NODE_EXTRA_CA_CERTS: "/home/ec2-user/certs/global-bundle.pem"
        }
      }
    ]
  };