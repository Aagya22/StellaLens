'use client';

import React from 'react';

interface AboutUsSectionProps {
  activeTab: 'home' | 'jewelry' | 'about';
  goToTab: (tab: 'home' | 'jewelry' | 'about') => void;
}

export default function AboutUsSection({ activeTab }: AboutUsSectionProps) {
  return null;
}
