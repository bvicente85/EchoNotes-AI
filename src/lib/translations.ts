export interface TranslationKeys {
  // login
  welcomeBack: string;
  createAccount: string;
  signInToAccess: string;
  startCapturing: string;
  emailAddress: string;
  password: string;
  orContinueWith: string;
  dontHaveAccount: string;
  createOne: string;
  alreadyHaveAccount: string;
  signIn: string;
  precisionAudio: string;
  creatingAccountSuccess: string;
  loginError: string;
  googleError: string;

  // sidebar & navigation
  navigation: string;
  dashboard: string;
  recentSessions: string;
  pinnedSessions: string;
  manageAccount: string;
  settings: string;

  // history
  allSessions: string;
  searchPlaceholder: string;
  sortBy: string;
  date: string;
  title: string;
  mostRecent: string;
  leastRecent: string;
  noSessionsYet: string;
  startRecordingToBegin: string;
  noSessionsMatch: string;
  rename: string;
  delete: string;
  save: string;
  cancel: string;
  confirmDeleteAllTitle: string;
  confirmDeleteTitle: string;
  confirmDeleteAllDesc: string;
  confirmDeleteDesc: string;

  // settings view
  profile: string;
  yourName: string;
  recording: string;
  defaultRecordingMode: string;
  inPerson: string;
  virtualMeeting: string;
  appearance: string;
  theme: string;
  light: string;
  dark: string;
  aiPreferences: string;
  outputLanguage: string;
  summaryDetailLevel: string;
  concise: string;
  detailed: string;
  about: string;
  signOut: string;
  saveChanges: string;
  saved: string;

  // main dash
  recordMeetingsTitle: string;
  extractIntelligence: string;
  dashboardDesc: string;
  uploadFile: string;
  startSession: string;
  stopSession: string;
  liveRecording: string;
  virtualMeetingSetup: string;
  screenSetupStep1: string;
  screenSetupStep2: string;
  screenSetupStep3: string;
  screenSetupStep4: string;
  screenSetupStep5: string;
  synthesizingIntelligence: string;
  processingDesc: string;
  processingTime: string;
  activeIntelligenceReport: string;
  micUnavailable: string;
  systemAudioFallback: string;
  fileAnalysisError: string;

  // report view
  executiveSummary: string;
  keyHighlights: string;
  keyDecisions: string;
  nextActions: string;
  fullTranscript: string;
  meetingIntelligenceReport: string;
  clientNameLabel: string;
  clientNamePlaceholder: string;
  meetingDateLabel: string;
  copyReport: string;
  copied: string;
  downloadPdf: string;
  downloadJson: string;
  goBack: string;
  addNewItem: string;
  speaker: string;
  timestamp: string;
  editTranscriptWord: string;
  editSummaryWord: string;
  optimizeVolume: string;
  unnamedMeeting: string;

  // ask gemini
  askGeminiHeader: string;
  askGeminiDesc: string;
  askGeminiPlaceholder: string;
  askGeminiError: string;
  askGeminiGreeting: string;
  askGeminiGreetingDesc: string;
  geminiThinking: string;

  // file upload and file specific strings
  optimizeVolumeTitle: string;
  optimizeVolumeDesc: string;
  dragDropOrClick: string;
  browseFilesButton: string;
  lowVolumeAlertButton: string;
  geminiAnalysisRunning: string;
  transcribeWithGemini: string;
  supportedFormatsText: string;
  maxSizeText: string;

  // New keys for ReportView and settings/nav
  sessionAnalysis: string;
  intelligenceReport: string;
  discardReport: string;
  sessionTimeline: string;
  speakers: string;
  interactions: string;
  decisions: string;
  pendingActions: string;
  enterStrategicAnalysis: string;
  addDecision: string;
  enterDecisionDetails: string;
  noDecisionsRecorded: string;
  exportManagement: string;
  exportOfficialPdf: string;
  copyMarkdown: string;
  downloadMdFile: string;
  downloadJsonFile: string;
  speakerDiarizationDesc: string;
  includeInExport: string;
  exportTranscriptTxt: string;
  clickToRenameSpeaker: string;
  sessionsNav: string;
  changeTheme: string;
  adminDashboardNav: string;
  clearHistory: string;
  clickToEditTitle: string;
  expectedSpeakersLabel: string;
  expectedSpeakersPlaceholder: string;
  recoveryTitle: string;
  recoveryDesc: string;
  recoverButton: string;
  discardRecovery: string;
}

export const translations: Record<'portuguese' | 'english' | string, TranslationKeys> = {
  portuguese: {
    welcomeBack: "Bem-vindo de volta",
    createAccount: "Criar Conta",
    signInToAccess: "Inicie sessão para aceder às suas notas de reunião",
    startCapturing: "Comece a capturar as suas reuniões com IA",
    emailAddress: "Endereço de E-mail",
    password: "Palavra-passe",
    orContinueWith: "Ou continue com",
    dontHaveAccount: "Não tem uma conta?",
    createOne: "Criar uma",
    alreadyHaveAccount: "Já tem uma conta?",
    signIn: "Iniciar sessão",
    precisionAudio: "Captura de Áudio de Precisão e Análise de IA",
    creatingAccountSuccess: "Conta criada com sucesso! Por favor, verifique o seu e-mail.",
    loginError: "Ocorreu um erro durante a autenticação",
    googleError: "Ocorreu um erro durante a autenticação com o Google",

    navigation: "Navegação",
    dashboard: "Dashboard",
    recentSessions: "Sessões Recentes",
    pinnedSessions: "Sessões Fixadas",
    manageAccount: "Gerir Conta",
    settings: "Configurações",

    allSessions: "Todas as Sessões",
    searchPlaceholder: "Procurar sessões ou notas...",
    sortBy: "Ordenado por",
    date: "Data",
    title: "Título",
    mostRecent: "Mais Recentes",
    leastRecent: "Mais Antigas",
    noSessionsYet: "Sem sessões ainda",
    startRecordingToBegin: "Grave ou carregue uma reunião para começar.",
    noSessionsMatch: "Nenhum resultado corresponde à procura.",
    rename: "Renomear",
    delete: "Eliminar",
    save: "Guardar",
    cancel: "Cancelar",
    confirmDeleteAllTitle: "Limpar todo o histórico?",
    confirmDeleteTitle: "Eliminar Reunião?",
    confirmDeleteAllDesc: "Esta ação removerá permanentemente todas as suas reuniões gravadas. Esta ação não pode ser desfeita.",
    confirmDeleteDesc: "Tem a certeza de que deseja eliminar este relatório de reunião? Esta ação não pode ser desfeita.",

    profile: "Perfil",
    yourName: "O seu nome",
    recording: "Gravação",
    defaultRecordingMode: "Modo de Gravação Padrão",
    inPerson: "Presencial",
    virtualMeeting: "Encontro Virtual",
    appearance: "Aparência",
    theme: "Tema",
    light: "Claro",
    dark: "Escuro",
    aiPreferences: "Preferências de IA",
    outputLanguage: "Idioma de Saída",
    summaryDetailLevel: "Nível de Detalhe do Resumo",
    concise: "Conciso",
    detailed: "Detalhado",
    about: "Sobre",
    signOut: "Sair",
    saveChanges: "Guardar Alterações",
    saved: "Guardado",

    recordMeetingsTitle: "Registe as suas reuniões,",
    extractIntelligence: "extraia a inteligência essencial.",
    dashboardDesc: "Transforme as suas gravações de voz em resumos executivos detalhados, decisões bem definidas e passos seguintes claros usando inteligência artificial avançada.",
    uploadFile: "Carregar Ficheiro",
    startSession: "Iniciar Sessão",
    stopSession: "Parar Sessão",
    liveRecording: "Gravação ao Vivo",
    virtualMeetingSetup: "Configuração de Encontro Virtual",
    screenSetupStep1: "Clique em Iniciar Sessão abaixo.",
    screenSetupStep2: "Na janela de pop-up, clique no separador \"Ecrã Inteiro\".",
    screenSetupStep3: "Clique na imagem do seu ecrã para selecioná-la.",
    screenSetupStep4: "Marque a caixa no fundo: \"Partilhar áudio do sistema\".",
    screenSetupStep5: "Clique em Partilhar para começar.",
    synthesizingIntelligence: "Sintetizando Inteligência...",
    processingDesc: "A nossa IA está a separar os oradores, a analisar os temas principais e a redigir o seu relatório de negócios.",
    processingTime: "Tempo de processamento",
    activeIntelligenceReport: "Relatório de inteligência ativo",
    micUnavailable: "Não foi possível aceder ao microfone. Por favor, verifique as permissões do seu navegador.",
    systemAudioFallback: "Para gravar uma reunião virtual, deve selecionar um separador/janela e marcar a opção 'Partilhar áudio'. Revertendo apenas para microfone.",
    fileAnalysisError: "Falha ao analisar o ficheiro de áudio. Certifique-se de que é um formato válido e tem menos de 20MB.",

    executiveSummary: "Resumo Executivo",
    keyHighlights: "Destaques Principais",
    keyDecisions: "Decisões Chave",
    nextActions: "Passos Seguintes",
    fullTranscript: "Transcrição Completa",
    meetingIntelligenceReport: "Relatório de Inteligência da Reunião",
    clientNameLabel: "Identidade do Cliente",
    clientNamePlaceholder: "Nome do cliente ou empresa...",
    meetingDateLabel: "Data da Reunião",
    copyReport: "Copiar Relatório",
    copied: "Copiado!",
    downloadPdf: "Descarregar PDF",
    downloadJson: "Descarregar JSON",
    goBack: "Voltar para Gravação",
    addNewItem: "Adicionar novo item",
    speaker: "Orador",
    timestamp: "Carimbo de data/hora",
    editTranscriptWord: "Editar Transcrição",
    editSummaryWord: "Editar Resumo",
    optimizeVolume: "Otimizar baixo volume",
    unnamedMeeting: "Sessão Sem Nome",

    askGeminiHeader: "Pergunte ao Gemini",
    askGeminiDesc: "Assistente de IA",
    askGeminiPlaceholder: "Pergunte sobre as suas reuniões...",
    askGeminiError: "Desculpe, ocorreu um erro ao processar a sua pergunta. Por favor, tente novamente.",
    askGeminiGreeting: "Pergunte sobre as suas reuniões",
    askGeminiGreetingDesc: "\"O que decidimos sobre o EcoInsight?\" ou \"Compare isto com a minha reunião anterior.\"",
    geminiThinking: "O Gemini está a pensar...",

    optimizeVolumeTitle: "Otimização de Voz",
    optimizeVolumeDesc: "Melhora vozes baixas ou distantes automaticamente.",
    dragDropOrClick: "Arraste e solte o ficheiro de áudio aqui, ou clique para procurar.",
    browseFilesButton: "Procurar Ficheiros",
    lowVolumeAlertButton: "Análise Gemini em curso...",
    geminiAnalysisRunning: "Análise Gemini em curso...",
    transcribeWithGemini: "Transcrever com Gemini",
    supportedFormatsText: "Suporta WAV, MP3, AAC, WEBM, OGG",
    maxSizeText: "Máximo 20MB",

    sessionAnalysis: "Análise de Sessão",
    intelligenceReport: "Relatório de Inteligência",
    discardReport: "Descartar Relatório",
    sessionTimeline: "Cronologia da Sessão",
    speakers: "Intervenientes",
    interactions: "Interações",
    decisions: "Decisões",
    pendingActions: "Ações Pendentes",
    enterStrategicAnalysis: "Introduza a análise estratégica...",
    addDecision: "Adicionar Decisão",
    enterDecisionDetails: "Introduza os detalhes da decisão...",
    noDecisionsRecorded: "Nenhuma decisão registada",
    exportManagement: "Gestão de Exportações",
    exportOfficialPdf: "Exportar PDF Oficial",
    copyMarkdown: "Copiar Markdown",
    downloadMdFile: "Descarregar ficheiro .md",
    downloadJsonFile: "Descarregar ficheiro .json",
    speakerDiarizationDesc: "Diarização automática de intervenientes e fluxo de voz",
    includeInExport: "Incluir na Exportação",
    exportTranscriptTxt: "Exportar Transcrição (.txt)",
    clickToRenameSpeaker: "Clique para renomear este orador globalmente",
    sessionsNav: "Sessões",
    changeTheme: "Mudar Tema",
    adminDashboardNav: "Dashboard de Administrador",
    clearHistory: "Limpar histórico",
    clickToEditTitle: "Clique para editar o título",
    expectedSpeakersLabel: "Participantes Esperados (opcional)",
    expectedSpeakersPlaceholder: "Ex: Bruno Filipe, Ana Santos (separados por vírgula)",
    recoveryTitle: "Sessão Interrompida Detetada",
    recoveryDesc: "Detetámos uma gravação que foi interrompida devido a um fecho inesperado ou falha de energia. Deseja recuperar esta gravação e gerar o relatório/análise?",
    recoverButton: "Recuperar e Analisar",
    discardRecovery: "Descartar"
  },
  english: {
    welcomeBack: "Welcome Back",
    createAccount: "Create Account",
    signInToAccess: "Sign in to access your meeting notes",
    startCapturing: "Start capturing your meetings with AI",
    emailAddress: "Email Address",
    password: "Password",
    orContinueWith: "Or continue with",
    dontHaveAccount: "Don't have an account?",
    createOne: "Create one",
    alreadyHaveAccount: "Already have an account?",
    signIn: "Sign In",
    precisionAudio: "Precision Audio Capture & AI Analysis",
    creatingAccountSuccess: "Account created successfully! Please check your email.",
    loginError: "An error occurred during authentication",
    googleError: "An error occurred during Google authentication",

    navigation: "Navigation",
    dashboard: "Dashboard",
    recentSessions: "Recent Sessions",
    pinnedSessions: "Pinned Sessions",
    manageAccount: "Manage Account",
    settings: "Settings",

    allSessions: "All Sessions",
    searchPlaceholder: "Search sessions or notes...",
    sortBy: "Sorted by",
    date: "Date",
    title: "Title",
    mostRecent: "Most Recent",
    leastRecent: "Oldest First",
    noSessionsYet: "No sessions yet",
    startRecordingToBegin: "Record or upload a meeting to get started.",
    noSessionsMatch: "No results match your search.",
    rename: "Rename",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    confirmDeleteAllTitle: "Clear All History?",
    confirmDeleteTitle: "Delete Meeting?",
    confirmDeleteAllDesc: "This will permanently remove all your recorded meetings. This action cannot be undone.",
    confirmDeleteDesc: "Are you sure you want to delete this meeting report? This action cannot be undone.",

    profile: "Profile",
    yourName: "Your name",
    recording: "Recording",
    defaultRecordingMode: "Default Recording Mode",
    inPerson: "In-Person",
    virtualMeeting: "Virtual Meeting",
    appearance: "Appearance",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    aiPreferences: "AI Preferences",
    outputLanguage: "Output Language",
    summaryDetailLevel: "Summary Detail Level",
    concise: "Concise",
    detailed: "Detailed",
    about: "About",
    signOut: "Sign Out",
    saveChanges: "Save Changes",
    saved: "Saved",

    recordMeetingsTitle: "Record your meetings,",
    extractIntelligence: "extract the essential intelligence.",
    dashboardDesc: "Transform your voice recordings into detailed executive summaries, well-defined decisions, and clear next steps using advanced artificial intelligence.",
    uploadFile: "Upload File",
    startSession: "Start Session",
    stopSession: "Stop Session",
    liveRecording: "Live Recording",
    virtualMeetingSetup: "Virtual Meeting Setup",
    screenSetupStep1: "Click Start Session below.",
    screenSetupStep2: "In the browser popup, click the \"Entire Screen\" tab.",
    screenSetupStep3: "Click the image of your screen to select it.",
    screenSetupStep4: "Check the box at the bottom: \"Share system audio\".",
    screenSetupStep5: "Click Share to begin.",
    synthesizingIntelligence: "Synthesizing Intelligence...",
    processingDesc: "Our AI is currently separating speakers, analyzing key themes, and drafting your business report.",
    processingTime: "Processing time",
    activeIntelligenceReport: "Active intelligence report",
    micUnavailable: "Could not access microphone. Please check your browser permissions.",
    systemAudioFallback: "To record a virtual meeting, you must select a tab/window and check 'Share audio'. Falling back to microphone only.",
    fileAnalysisError: "Failed to analyze the audio file. Make sure it's a valid audio format and its size is under 20MB.",

    executiveSummary: "Executive Summary",
    keyHighlights: "Key Highlights",
    keyDecisions: "Key Decisions",
    nextActions: "Next Actions",
    fullTranscript: "Full Transcript",
    meetingIntelligenceReport: "Meeting Intelligence Report",
    clientNameLabel: "Client Identity",
    clientNamePlaceholder: "Client or company name...",
    meetingDateLabel: "Meeting Date",
    copyReport: "Copy Report",
    copied: "Copied!",
    downloadPdf: "Download PDF",
    downloadJson: "Download JSON",
    goBack: "Go Back to Recording",
    addNewItem: "Add new item",
    speaker: "Speaker",
    timestamp: "Timestamp",
    editTranscriptWord: "Edit Transcript",
    editSummaryWord: "Edit Summary",
    optimizeVolume: "Optimize low volume",
    unnamedMeeting: "Unnamed Meeting",

    askGeminiHeader: "Ask Gemini",
    askGeminiDesc: "AI Assistant",
    askGeminiPlaceholder: "Ask about your meetings...",
    askGeminiError: "Sorry, an error occurred while processing your question. Please try again.",
    askGeminiGreeting: "Ask about your meetings",
    askGeminiGreetingDesc: '"What did we decide about EcoInsight?" or "Compare this to my previous meeting."',
    geminiThinking: "Gemini is thinking...",

    optimizeVolumeTitle: "Voice Optimization",
    optimizeVolumeDesc: "Boosts quiet or distant voices automatically.",
    dragDropOrClick: "Drag and drop your audio file here, or click to browse.",
    browseFilesButton: "Browse Files",
    lowVolumeAlertButton: "Gemini analysis in progress...",
    geminiAnalysisRunning: "Gemini analysis in progress...",
    transcribeWithGemini: "Transcribe with Gemini",
    supportedFormatsText: "Supports WAV, MP3, AAC, WEBM, OGG",
    maxSizeText: "Maximum 20MB",

    sessionAnalysis: "Session Analysis",
    intelligenceReport: "Intelligence Report",
    discardReport: "Discard Report",
    sessionTimeline: "Session Timeline",
    speakers: "Speakers",
    interactions: "Interactions",
    decisions: "Decisions",
    pendingActions: "Pending Actions",
    enterStrategicAnalysis: "Enter strategic analysis details...",
    addDecision: "Add Decision",
    enterDecisionDetails: "Enter decision details...",
    noDecisionsRecorded: "No decisions recorded",
    exportManagement: "Export Management",
    exportOfficialPdf: "Export Official PDF",
    copyMarkdown: "Copy Markdown",
    downloadMdFile: "Download .md file",
    downloadJsonFile: "Download .json file",
    speakerDiarizationDesc: "Speaker diarization and voice flow logs",
    includeInExport: "Include in Export",
    exportTranscriptTxt: "Export Transcript (.txt)",
    clickToRenameSpeaker: "Click to rename this speaker globally",
    sessionsNav: "Sessions",
    changeTheme: "Change Theme",
    adminDashboardNav: "Admin Dashboard",
    clearHistory: "Clear history",
    clickToEditTitle: "Click to edit title",
    expectedSpeakersLabel: "Expected Participants (optional)",
    expectedSpeakersPlaceholder: "e.g., Bruno Filipe, Ana Santos (comma-separated)",
    recoveryTitle: "Interrupted Session Detected",
    recoveryDesc: "We detected an interrupted recording from a previous unexpected session closure. Would you like to recover this recording and generate the report/analysis?",
    recoverButton: "Recover and Analyze",
    discardRecovery: "Discard"
  }
};
