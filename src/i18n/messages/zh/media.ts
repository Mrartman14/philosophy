// src/i18n/messages/zh/media.ts
// Mirror of ru/media.ts. Key parity is enforced by satisfies Messages.
const media = {
  // --- type and status ---
  typeVideo: "视频",
  typeAudio: "音频",
  statusPublic: "已发布",
  statusPrivate: "私有",

  // --- player ---
  playerArtist: "Философия ликбез",
  pipEnter: "画中画",
  pipExit: "退出画中画",

  // --- empty states / informational ---
  emptyTitle: "暂无媒体",
  emptyDescription: "上传视频或音频文件，它将显示在这里。",
  unavailable: "文件无法播放。",
  videoBrowserFallback: "您的浏览器不支持视频播放。",
  audioBrowserFallback: "您的浏览器不支持音频播放。",

  // --- lectures section on media page ---
  lecturesSection: "讲座",
  noContainers: "该媒体未附加到任何讲座。",
  lectureLink: "讲座 {id}…",

  // --- deletion ---
  deleteButton: "删除",
  deleteTitle: "删除媒体？",
  deleteDescription: "此操作不可逆。文件将被删除，所有指向它的链接将失效。",
  deleteDescriptionAdmin: "由管理员删除。此操作不可逆：文件将被删除，所有指向它的链接将失效。",
  deleteAction: "删除媒体",

  // --- publishing ---
  publishButton: "发布",
  publishTitle: "发布媒体？",
  publishDescription:
    "发布后，媒体将变为公开。无法再改回私有——只能删除。",
  publishedToast: "已发布",
  publishAction: "发布媒体",

  // --- upload form ---
  uploadTypeLabel: "类型",
  uploadVideoOption: "视频（mp4、webm）",
  uploadAudioOption: "音频（mp3、m4a、ogg）",
  uploadFileLabel: "文件",
  uploadSubmit: "上传",
  uploadHint: "新媒体创建后为私有。您可以在其页面上发布它。",
  uploadSuccessTitle: "已上传",
  uploadAction: "上传媒体",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadMyFailed: "无法加载媒体",
    loadItemFailed: "无法加载媒体",
    loadContainersFailed: "无法加载容器",
    loadAdminFailed: "无法加载媒体列表",
  },
};

export default media;
