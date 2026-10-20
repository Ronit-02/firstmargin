import config from './playwright.config.js'

export default {
  ...config,
  projects: config.projects.map(project => ({
    ...project,
    use: {
      ...project.use,
      video: 'off',
      launchOptions: { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
    },
  })),
}
