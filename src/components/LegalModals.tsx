import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms';
  language: string;
}

export function LegalModal({ isOpen, onClose, type, language }: LegalModalProps) {
  if (!isOpen) return null;

  const isPt = language === 'portuguese';

  const title = type === 'privacy' 
    ? (isPt ? 'Política de Privacidade' : 'Privacy Policy')
    : (isPt ? 'Termos de Serviço' : 'Terms of Service');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      {/* Modal Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
          <h2 className="text-base sm:text-lg font-display font-black text-slate-900 dark:text-white">
            {title}
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal text-left">
          {type === 'privacy' ? (
            isPt ? <PrivacyPolicyPt /> : <PrivacyPolicyEn />
          ) : (
            isPt ? <TermsOfServicePt /> : <TermsOfServiceEn />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/60 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-app-accent hover:bg-app-dark-green text-white text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer shadow-xs active:scale-[0.98]"
          >
            {isPt ? 'Fechar' : 'Close'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ==========================================
   PORTUGUESE PRIVACY POLICY
   ========================================== */
function PrivacyPolicyPt() {
  return (
    <div className="space-y-4">
      <p className="font-semibold text-slate-800 dark:text-slate-200">Última atualização: 16 de Julho de 2026</p>
      
      <p>
        A <strong>SUMA</strong> está empenhada em proteger a sua privacidade e em garantir a conformidade com o 
        Regulamento Geral sobre a Proteção de Dados (RGPD / GDPR) e outras leis aplicáveis de proteção de dados. 
        Esta Política de Privacidade explica como recolhemos, utilizamos, armazenamos e protegemos os seus dados pessoais.
      </p>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        1. Dados que Recolhemos
      </h3>
      <p>Recolhemos os seguintes dados pessoais e de utilização para lhe fornecer o nosso serviço:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Informações de Registo:</strong> Endereço de e-mail e palavra-passe (encriptada).</li>
        <li><strong>Gravações de Áudio:</strong> Ficheiros de voz capturados pelo microfone ou carregados para processamento.</li>
        <li><strong>Conteúdo Transcritor e IA:</strong> As transcrições automáticas das suas gravações e os resumos gerados pela Inteligência Artificial.</li>
        <li><strong>Dados de Utilização:</strong> Endereço IP aproximado, preferências de idioma e tema selecionados na aplicação.</li>
      </ul>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        2. Finalidade e Base Legal do Tratamento
      </h3>
      <p>Tratamos os seus dados com base nas seguintes justificações legais:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Consentimento do Utilizador:</strong> Para processar a sua voz (dados biométricos/sensíveis) e gerar atas automáticas.</li>
        <li><strong>Execução de Contrato:</strong> Para gerir a sua conta e fornecer as funcionalidades principais da aplicação.</li>
        <li><strong>Interesse Legítimo:</strong> Para melhorar a segurança do sistema e monitorizar erros de performance.</li>
      </ul>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        3. Partilha de Dados com Terceiros
      </h3>
      <p>Para fornecer a análise inteligente e o armazenamento seguro, partilhamos dados com:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Supabase:</strong> Utilizado para armazenar com segurança a sua conta, preferências e o histórico de atas.</li>
        <li><strong>Google Gemini API:</strong> Os seus dados de texto/áudio são enviados à Google Cloud para gerar as atas de reunião. A Google compromete-se a não utilizar os dados submetidos através de chaves empresariais/API para treinar os seus modelos públicos.</li>
        <li><strong>Vercel:</strong> Plataforma que aloja a interface web da aplicação de forma segura e encriptada.</li>
      </ul>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        4. Retenção e Segurança dos Dados
      </h3>
      <p>
        Os seus dados são transmitidos de forma encriptada (HTTPS/TLS) e armazenados usando encriptação em repouso. 
        Os ficheiros de áudio locais podem ser geridos por si nas configurações. Reteremos as suas atas apenas 
        enquanto a sua conta estiver ativa ou conforme necessário para lhe prestar o serviço.
      </p>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        5. Os Seus Direitos (RGPD)
      </h3>
      <p>Como utilizador, possui os seguintes direitos ao abrigo do RGPD:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Acesso e Retificação:</strong> O direito de consultar e corrigir os seus dados pessoais.</li>
        <li><strong>Eliminação (Direito ao Esquecimento):</strong> O direito de apagar a sua conta e todas as notas associadas de forma permanente no menu de configurações.</li>
        <li><strong>Oposição e Limitação:</strong> O direito de revogar o seu consentimento para o tratamento de áudio a qualquer momento.</li>
      </ul>
      <p className="pt-2">
        Para exercer qualquer um destes direitos ou esclarecer dúvidas, por favor contacte a nossa equipa de suporte ou utilize as opções disponíveis na sua área de utilizador.
      </p>
    </div>
  );
}

/* ==========================================
   ENGLISH PRIVACY POLICY
   ========================================== */
function PrivacyPolicyEn() {
  return (
    <div className="space-y-4">
      <p className="font-semibold text-slate-800 dark:text-slate-200">Last updated: July 16, 2026</p>
      
      <p>
        <strong>SUMA</strong> is committed to protecting your privacy and ensuring compliance with the General 
        Data Protection Regulation (GDPR) and other applicable data protection laws. This Privacy Policy explains 
        how we collect, use, store, and safeguard your personal data.
      </p>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        1. Data We Collect
      </h3>
      <p>We collect the following personal and usage data to provide our service:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Registration Info:</strong> Email address and encrypted password.</li>
        <li><strong>Audio Recordings:</strong> Voice files captured via microphone or uploaded for processing.</li>
        <li><strong>AI Transcripts & Summaries:</strong> Automatic text transcriptions of your recordings and AI-generated meeting summaries.</li>
        <li><strong>Usage Data:</strong> Approximate IP address, active language preference, and chosen UI theme.</li>
      </ul>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        2. Legal Basis for Processing
      </h3>
      <p>We process your data under the following legal bases:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>User Consent:</strong> Required to process your audio (sensitive/biometric data) and generate meeting minutes.</li>
        <li><strong>Performance of Contract:</strong> To manage your account and deliver the application's core features.</li>
        <li><strong>Legitimate Interest:</strong> For monitoring system errors, performance logs, and enhancing platform security.</li>
      </ul>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        3. Sharing Data with Third Parties
      </h3>
      <p>To provide AI-driven analysis and secure cloud storage, we share data with:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Supabase:</strong> Used to securely host and store your user profile, configurations, and meeting history.</li>
        <li><strong>Google Gemini API:</strong> Audio and text inputs are sent to Google Cloud to generate the intelligence report. Google commits not to use data sent via API keys to train its public generative models.</li>
        <li><strong>Vercel:</strong> Used to host our application's web interface using encrypted connections.</li>
      </ul>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        4. Data Retention and Security
      </h3>
      <p>
        Your data is transmitted securely (HTTPS/TLS) and stored with encryption at rest. 
        Local audio storage can be cleared manually in your settings view. We retain your notes 
        only for as long as your account remains active or as needed to provide our services.
      </p>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        5. Your Rights (GDPR)
      </h3>
      <p>As a user, you possess the following rights under GDPR legislation:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Access and Rectify:</strong> The right to view and correct the personal data we store.</li>
        <li><strong>Erasure (Right to be Forgotten):</strong> The right to completely delete your account and all associated meetings permanently.</li>
        <li><strong>Withdrawal of Consent:</strong> The right to withdraw consent for voice and audio processing at any time.</li>
      </ul>
      <p className="pt-2">
        To exercise these rights, please contact our support team or use the direct options provided in your Settings panel.
      </p>
    </div>
  );
}

/* ==========================================
   PORTUGUESE TERMS OF SERVICE
   ========================================== */
function TermsOfServicePt() {
  return (
    <div className="space-y-4">
      <p className="font-semibold text-slate-800 dark:text-slate-200">Última atualização: 16 de Julho de 2026</p>
      
      <p>
        Bem-vindo ao <strong>SUMA</strong>. Ao registar-se ou utilizar a nossa aplicação, concorda em ficar vinculado 
        por estes Termos de Serviço. Leia-os atentamente antes de utilizar o serviço.
      </p>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        1. Descrição do Serviço
      </h3>
      <p>
        O SUMA é uma ferramenta de produtividade baseada em Inteligência Artificial que permite gravar ou carregar áudio, 
        transcrevê-lo automaticamente e gerar resumos, atas e listas de tarefas estruturadas.
      </p>

      <h3 className="text-[11px] sm:text-xs font-black uppercase text-red-500 tracking-wider pt-2 flex items-center gap-1.5">
        ⚠️ IMPORTANTE: Consentimento dos Participantes (Requisito Legal)
      </h3>
      <p className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 p-3 rounded-xl border border-red-100 dark:border-red-950/30">
        O utilizador é o <strong>único e exclusivo responsável</strong> por obter o consentimento claro e prévio 
        de todos os participantes na reunião antes de iniciar qualquer gravação ou carregamento de áudio para a plataforma. 
        Gravar indivíduos sem o seu conhecimento ou consentimento é ilegal em muitas jurisdições e constitui uma violação 
        grave destes Termos de Serviço.
      </p>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        2. Responsabilidade do Utilizador e Contas
      </h3>
      <p>Ao criar uma conta, garante que:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>As credenciais de acesso são confidenciais e de seu uso pessoal.</li>
        <li>Não utilizará a aplicação para fins ilícitos, prejudiciais ou abusivos.</li>
        <li>Não submeterá materiais protegidos por direitos de autor ou dados médicos/confidenciais sem ter as devidas autorizações e conformidades contratadas.</li>
      </ul>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        3. Limitação de Responsabilidade sobre Inteligência Artificial
      </h3>
      <p>
        As atas de reunião e relatórios gerados pelo SUMA são processados por modelos avançados de Inteligência Artificial. 
        Embora nos esforcemos por obter a máxima precisão, <strong>a Inteligência Artificial pode gerar erros, transcrições imprecisas 
        ou alucinações de dados</strong>. O utilizador é responsável por rever e validar todo o conteúdo de atas antes de o partilhar, 
        arquivar ou utilizar para fins contratuais ou legais.
      </p>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        4. Modificação e Terminação dos Serviços
      </h3>
      <p>
        Reservamo-nos o direito de alterar, suspender ou terminar os serviços a qualquer momento para atualizações do sistema 
        ou em caso de abuso ou incumprimento das regras descritas nestes Termos de Serviço.
      </p>
    </div>
  );
}

/* ==========================================
   ENGLISH TERMS OF SERVICE
   ========================================== */
function TermsOfServiceEn() {
  return (
    <div className="space-y-4">
      <p className="font-semibold text-slate-800 dark:text-slate-200">Last updated: July 16, 2026</p>
      
      <p>
        Welcome to <strong>SUMA</strong>. By registering or using our application, you agree to be bound by 
        these Terms of Service. Please read them carefully before using the service.
      </p>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        1. Description of the Service
      </h3>
      <p>
        SUMA is an Artificial Intelligence productivity tool that enables users to record or upload audio, 
        automatically transcribe it, and generate structured summaries, minutes, and checklists.
      </p>

      <h3 className="text-[11px] sm:text-xs font-black uppercase text-red-500 tracking-wider pt-2 flex items-center gap-1.5">
        ⚠️ IMPORTANT: Participant Consent (Legal Requirement)
      </h3>
      <p className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 p-3 rounded-xl border border-red-100 dark:border-red-950/30">
        You are <strong>solely and exclusively responsible</strong> for obtaining the clear, prior consent of all 
        meeting participants before initiating any recording or uploading audio files to the platform. 
        Recording individuals without their consent is illegal in many jurisdictions and constitutes a severe 
        violation of these Terms of Service.
      </p>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        2. User Responsibility and Accounts
      </h3>
      <p>By creating an account, you warrant that:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Your login credentials remain confidential and are strictly for your personal use.</li>
        <li>You will not use the application for any unlawful, harmful, or abusive purpose.</li>
        <li>You will not submit copyrighted materials or confidential medical/personal data without possessing the proper authorizations or contracted compliance tiers.</li>
      </ul>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        3. Limitation of Liability on AI Outputs
      </h3>
      <p>
        Meeting minutes and reports generated by SUMA are processed by generative AI models. 
        While we strive for accuracy, <strong>AI models can generate inaccuracies, wrong transcriptions, or data hallucinations</strong>. 
        You are responsible for reviewing and verifying all generated summaries before sharing, archiving, or relying 
        on them for business, legal, or contractual decisions.
      </p>

      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-150 pt-2 border-b border-slate-100 dark:border-slate-800/40 pb-1">
        4. Modification and Termination of Service
      </h3>
      <p>
        We reserve the right to modify, suspend, or terminate services at any time for system maintenance 
        or in cases of abuse or non-compliance with these Terms of Service.
      </p>
    </div>
  );
}
