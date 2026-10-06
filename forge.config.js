module.exports = {
  packagerConfig: {
    asar: true,
    icon: './assets/mindflow-icon',
    ignore: [/(^|[\\/])\.npm-cache([\\/]|$)/, /(^|[\\/])\.electron-cache([\\/]|$)/, /(^|[\\/])\.test-data([\\/]|$)/, /(^|[\\/])\.test-desktop-data([\\/]|$)/, /(^|[\\/])\.test-desktop-appdata([\\/]|$)/, /(^|[\\/])tests([\\/]|$)/, /(^|[\\/])scripts([\\/]|$)/]
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: { name: 'MindFlow', authors: 'MindFlow contributors', description: 'Organize dias, hábitos, tarefas, finanças, foco e autocuidado.', setupIcon: './assets/mindflow-icon.ico' }
    }
  ]
};
