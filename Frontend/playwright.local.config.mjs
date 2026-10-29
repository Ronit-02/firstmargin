const { default: config } = await import(process.env.FIRSTMARGIN_UI_RUN === '1' ? './playwright.ui.config.js' : './playwright.config.js')

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
