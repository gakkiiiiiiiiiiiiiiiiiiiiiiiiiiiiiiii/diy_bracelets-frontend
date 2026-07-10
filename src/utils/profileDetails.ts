export const PROFILE_DETAILS_STORAGE_KEY = 'diy-bracelets-profile-details';

export interface ProfileDetailsDraft {
	name: string;
	phone: string;
	gender: string;
}

export const defaultProfileDetails: ProfileDetailsDraft = {
	name: 'Gakiiiiiiiiiiiiii',
	phone: '130****8619',
	gender: '男',
};

export function loadProfileDetails(): ProfileDetailsDraft {
	try {
		const raw = uni.getStorageSync(PROFILE_DETAILS_STORAGE_KEY);
		const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
		if (!data || typeof data !== 'object') return { ...defaultProfileDetails };
		return {
			name: typeof data.name === 'string' && data.name.trim() ? data.name : defaultProfileDetails.name,
			phone: typeof data.phone === 'string' && data.phone.trim() ? data.phone : defaultProfileDetails.phone,
			gender: typeof data.gender === 'string' && data.gender.trim() ? data.gender : defaultProfileDetails.gender,
		};
	} catch {
		return { ...defaultProfileDetails };
	}
}

export function saveProfileDetails(details: ProfileDetailsDraft) {
	uni.setStorageSync(PROFILE_DETAILS_STORAGE_KEY, JSON.stringify(details));
}
