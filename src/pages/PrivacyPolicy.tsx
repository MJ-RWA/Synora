import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Eye, FileText } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#050505] pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
              Privacy Policy
            </h1>
            <p className="text-gray-500">Last updated: March 19, 2026</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <Shield className="w-8 h-8 text-emerald-400" />
              <h3 className="text-xl font-bold">Data Protection</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                We use industry-standard security measures to protect your personal information from unauthorized access, disclosure, or destruction.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <Lock className="w-8 h-8 text-blue-400" />
              <h3 className="text-xl font-bold">Secure Access</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your account is protected by Firebase Authentication, ensuring that your credentials are encrypted and securely stored.
              </p>
            </div>
          </div>

          <div className="prose prose-invert max-w-none space-y-8">
            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Eye className="w-6 h-6 text-emerald-400" />
                Information We Collect
              </h2>
              <p className="text-gray-400 leading-relaxed">
                When you use Synora, we collect certain information to provide and improve our services:
              </p>
              <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
                <li>Account Information: Email address, display name, and profile picture provided via Google Login.</li>
                <li>Usage Data: Watch history, watch later lists, and interaction with our streaming features.</li>
                <li>Device Information: Browser type, operating system, and IP address for security and analytics.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6 text-emerald-400" />
                How We Use Your Information
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Your data is used strictly for the following purposes:
              </p>
              <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
                <li>To personalize your experience (e.g., "Continue Watching" features).</li>
                <li>To maintain your playlists and watch history.</li>
                <li>To send important service updates or notifications.</li>
                <li>To analyze platform performance and prevent fraudulent activity.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Third-Party Services</h2>
              <p className="text-gray-400 leading-relaxed">
                We utilize Google Firebase for authentication and database management. By using Synora, you also agree to Google's Privacy Policy regarding these services. We do not sell your personal data to third parties.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Cookies</h2>
              <p className="text-gray-400 leading-relaxed">
                We use essential cookies to maintain your session and preferences. You can manage cookie settings in your browser, but some features of the platform may not function correctly without them.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Contact Us</h2>
              <p className="text-gray-400 leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at privacy@streamarena.com.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
