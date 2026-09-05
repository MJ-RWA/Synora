import React from 'react';
import { motion } from 'framer-motion';
import { Copyright, Mail, FileCheck, ShieldCheck } from 'lucide-react';

export const DMCA: React.FC = () => {
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
              DMCA Policy
            </h1>
            <p className="text-gray-500">Last updated: March 19, 2026</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <Copyright className="w-8 h-8 text-emerald-400" />
              <h3 className="text-xl font-bold">Copyright Protection</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Synora respects the intellectual property rights of others and expects its users to do the same.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <ShieldCheck className="w-8 h-8 text-blue-400" />
              <h3 className="text-xl font-bold">Compliance</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                We respond to notices of alleged copyright infringement that comply with the Digital Millennium Copyright Act (DMCA).
              </p>
            </div>
          </div>

          <div className="prose prose-invert max-w-none space-y-8">
            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FileCheck className="w-6 h-6 text-emerald-400" />
                Reporting Infringement
              </h2>
              <p className="text-gray-400 leading-relaxed">
                If you believe that your copyrighted work has been copied in a way that constitutes copyright infringement and is accessible on Synora, please notify our copyright agent. For your complaint to be valid under the DMCA, you must provide the following information:
              </p>
              <ul className="list-decimal list-inside text-gray-400 space-y-2 ml-4">
                <li>A physical or electronic signature of a person authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
                <li>Identification of the copyrighted work claimed to have been infringed.</li>
                <li>Identification of the material that is claimed to be infringing or to be the subject of infringing activity and that is to be removed or access to which is to be disabled.</li>
                <li>Information reasonably sufficient to permit the service provider to contact the complaining party, such as an address, telephone number, and, if available, an electronic mail address.</li>
                <li>A statement that the complaining party has a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.</li>
                <li>A statement that the information in the notification is accurate, and under penalty of perjury, that the complaining party is authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Mail className="w-6 h-6 text-emerald-400" />
                Contact Information
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Please send all DMCA notices to our designated copyright agent at:
              </p>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <p className="text-white font-bold">Copyright Agent</p>
                <p className="text-gray-400">Synora Legal Department</p>
                <p className="text-gray-400">Email: dmca@synora.app</p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Counter-Notification</h2>
              <p className="text-gray-400 leading-relaxed">
                If you believe that your content was removed or disabled by mistake or misidentification, you may send a counter-notification to our copyright agent. To be effective, the counter-notification must be a written communication that includes substantially the same information as required for a notification of infringement.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Repeat Infringer Policy</h2>
              <p className="text-gray-400 leading-relaxed">
                Synora reserves the right to terminate the accounts of users who are found to be repeat infringers of copyright.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Disclaimer</h2>
              <p className="text-gray-400 leading-relaxed">
                The information provided on this page is for informational purposes only and does not constitute legal advice. You should consult with an attorney for legal advice regarding your specific situation.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
