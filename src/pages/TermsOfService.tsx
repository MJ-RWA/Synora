import React from 'react';
import { motion } from 'framer-motion';
import { FileText, UserCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

export const TermsOfService: React.FC = () => {
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
              Terms of Service
            </h1>
            <p className="text-gray-500">Last updated: March 19, 2026</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <UserCheck className="w-8 h-8 text-emerald-400" />
              <h3 className="text-xl font-bold">User Agreement</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                By accessing or using Synora, you agree to be bound by these Terms of Service and all applicable laws and regulations.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <ShieldAlert className="w-8 h-8 text-blue-400" />
              <h3 className="text-xl font-bold">Safe Usage</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.
              </p>
            </div>
          </div>

          <div className="prose prose-invert max-w-none space-y-8">
            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6 text-emerald-400" />
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Synora provides its services to you subject to the following Terms of Service ("TOS"), which may be updated by us from time to time without notice to you. By using the site, you agree to these terms.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                2. Use of Service
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Synora is for personal, non-commercial use only. You agree not to:
              </p>
              <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
                <li>Reproduce, duplicate, copy, sell, trade, or resell any portion of the service.</li>
                <li>Use the service for any illegal purpose or in violation of any local, state, national, or international law.</li>
                <li>Attempt to gain unauthorized access to our servers or network.</li>
                <li>Interfere with or disrupt the service or servers or networks connected to the service.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">3. User Accounts</h2>
              <p className="text-gray-400 leading-relaxed">
                To access certain features, you must register for an account using Google Login. You agree to provide accurate, current, and complete information during the registration process. We reserve the right to suspend or terminate accounts that provide false information or violate these terms.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">4. Content Ownership</h2>
              <p className="text-gray-400 leading-relaxed">
                All content provided on Synora, including text, graphics, logos, and software, is the property of Synora or its content suppliers and is protected by international copyright laws.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">5. Disclaimer of Warranties</h2>
              <p className="text-gray-400 leading-relaxed italic">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">6. Limitation of Liability</h2>
              <p className="text-gray-400 leading-relaxed">
                In no event shall Synora be liable for any direct, indirect, incidental, special, or consequential damages arising out of or in any way connected with the use of the service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">7. Contact Information</h2>
              <p className="text-gray-400 leading-relaxed">
                Questions about the Terms of Service should be sent to us at support@streamarena.com.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
