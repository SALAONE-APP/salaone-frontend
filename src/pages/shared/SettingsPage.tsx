import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Store,
  Bell,
  Building2,
  ChevronDown,
  Shield,
  CreditCard,
  QrCode,
  Banknote,
  Mail,
  Palette,
  Save,
  Upload,
  Copy,
  Link2,
  Plus,
  X,
  CircleUserRound,
  FileText,
  ExternalLink,
  ClipboardList,
} from 'lucide-react';
import { PlatformSubscriptionTab } from '@/components/PlatformSubscriptionTab';
import { toast } from 'sonner';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { AppSelect } from '@/components/shared/AppSelect';
import {
  getSalonProfile,
  updateSalonProfile,
} from '../../service/salonProfileService';
import {
  createPagarmeRecipient,
  getPagarmeRecipient,
  updatePagarmeRecipient,
} from '../../service/pagarmeService';
import {
  getHomeInfo,
  type HomeInfo,
  updateHomeInfo,
} from '../../service/homeInfoService';
import {
  uploadBusinessLogo,
  uploadHeroImage,
  uploadPdf,
  uploadProfilePhoto,
} from '../../service/uploadService';
import {
  getPaymentFrequencySettings,
  getSettings,
  type BookingPaymentMethod,
  type PaymentFrequency,
  type Settings,
  type SubscriptionProfessionalRule,
  updatePaymentFrequencySettings,
  updateSettings,
} from '../../service/settingsService';
import { changePassword, updateProfilePhoto } from '../../service/userService';

type StoredSalon = {
  id?: string;
  name?: string;
  slug?: string;
  logoUrl?: string;
};

const PAYMENT_FREQUENCY_OPTIONS: Array<{
  value: PaymentFrequency;
  label: string;
}> = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
];

const MAX_HERO_IMAGES = 5;

interface SettingsProps {
  canShareRegistrationLink?: boolean;
}

function getStoredSalon() {
  const storedSalon = localStorage.getItem('salon');

  if (!storedSalon) {
    return null;
  }

  try {
    return JSON.parse(storedSalon) as StoredSalon;
  } catch {
    return null;
  }
}

function getApiErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;

    if (Array.isArray(data) && typeof data[0] === 'string') {
      return data[0];
    }

    if (
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof (data as { message?: unknown }).message === 'string'
    ) {
      return (data as { message: string }).message;
    }

    if (typeof data === 'string') {
      return data;
    }
  }

  return null;
}

function onlyDigits(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

function getHeroImages(data: HomeInfo) {
  const images = Array.isArray(data.hero_images)
    ? data.hero_images
    : [];
  const fallbackImage = data.hero_image ? [data.hero_image] : [];

  return [...images, ...fallbackImage]
    .map((image) => image.trim())
    .filter(Boolean)
    .filter((image, index, allImages) => allImages.indexOf(image) === index)
    .slice(0, MAX_HERO_IMAGES);
}

function formatCNPJ(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatPhone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

export function SettingsPage({ canShareRegistrationLink = false }: SettingsProps) {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(user?.photoUrl ?? '');
  const [isUploadingProfilePhoto, setIsUploadingProfilePhoto] = useState(false);
  const profilePhotoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [businessForm, setBusinessForm] = useState({
    name: '',
    email: '',
    phone: '',
    cnpj: '',
    googleMapsUrl: '',
  });
  const [businessSlug, setBusinessSlug] = useState('');
  const [businessLogoUrl, setBusinessLogoUrl] = useState('');
  const [isUploadingBusinessLogo, setIsUploadingBusinessLogo] = useState(false);
  const businessLogoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [homeInfo, setHomeInfo] = useState<HomeInfo | null>(null);
  const [heroForm, setHeroForm] = useState({
    hero_title: '',
    hero_subtitle: '',
    hero_images: [] as string[],
  });
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [isUploadingHeroImage, setIsUploadingHeroImage] = useState(false);
  const heroImageFileInputRef = useRef<HTMLInputElement | null>(null);
  const [workingHoursForm, setWorkingHoursForm] = useState({
    schedule_title: '',
    schedule_line1: '',
    schedule_line2: '',
    schedule_line3: '',
  });
  const [aboutForm, setAboutForm] = useState({
    about_title: '',
    about_text1: '',
    about_text2: '',
    about_text3: '',
  });
  const [locationForm, setLocationForm] = useState({
    location_title: '',
    location_address: '',
    location_city: '',
  });
  const [isLoadingBusinessProfile, setIsLoadingBusinessProfile] = useState(false);
  const [isLoadingHomeInfo, setIsLoadingHomeInfo] = useState(false);
  const [isSavingGeneralSettings, setIsSavingGeneralSettings] = useState(false);
  const [isSavingSalonData, setIsSavingSalonData] = useState(false);

  // Recebedor Pagar.me
  const [pagarmeRecipientId, setPagarmeRecipientId] = useState<string | null>(null);
  const [pagarmeRecipientStatus, setPagarmeRecipientStatus] = useState<string | null>(null);
  const [isSavingRecipient, setIsSavingRecipient] = useState(false);
  const [isLoadingRecipient, setIsLoadingRecipient] = useState(false);
  const [recipientExpanded, setRecipientExpanded] = useState(false);
  const [recipientErrors, setRecipientErrors] = useState<Record<string, boolean>>({});
  const [recipientForm, setRecipientForm] = useState({
    name: '', email: '', type: 'individual' as 'individual' | 'company',
    document: '', phone: '', birthdate: '', monthlyIncome: '',
    professionalOccupation: '',
    companyName: '', tradingName: '', annualRevenue: '',
    street: '', streetNumber: '', complementary: '', neighborhood: '',
    city: '', state: 'MG', zipCode: '', referencePoint: '',
    partnerName: '', partnerDocument: '', partnerEmail: '', partnerBirthdate: '',
    partnerMonthlyIncome: '', partnerProfessionalOccupation: '', partnerPhone: '',
    partnerStreet: '', partnerStreetNumber: '', partnerComplementary: '',
    partnerNeighborhood: '', partnerCity: '', partnerState: 'MG', partnerZipCode: '',
    bankHolderName: '', bankHolderType: 'individual' as 'individual' | 'company',
    bankHolderDocument: '', bank: '341', branchNumber: '', branchCheckDigit: '',
    accountNumber: '', accountCheckDigit: '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoadingSecuritySettings, setIsLoadingSecuritySettings] = useState(false);
  const [isSavingSecuritySettings, setIsSavingSecuritySettings] = useState(false);
  const [isUploadingTermsDocument, setIsUploadingTermsDocument] = useState(false);
  const termsDocumentFileInputRef = useRef<HTMLInputElement | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<
    Record<BookingPaymentMethod, boolean>
  >({
    cartao: true,
    pix: true,
    local: true,
  });
  const [professionalPaymentFrequency, setProfessionalPaymentFrequency] =
    useState<PaymentFrequency>('monthly');
  const [employeePaymentFrequency, setEmployeePaymentFrequency] =
    useState<PaymentFrequency>('monthly');
  const [hasLoadedPaymentSettings, setHasLoadedPaymentSettings] = useState(false);
  const [isLoadingPaymentSettings, setIsLoadingPaymentSettings] = useState(false);
  const [isSavingPaymentSettings, setIsSavingPaymentSettings] = useState(false);
  const [subscriptionProfessionalRule, setSubscriptionProfessionalRule] = useState<SubscriptionProfessionalRule>('fixed');
  const [hasLoadedProfessionalRule, setHasLoadedProfessionalRule] = useState(false);
  const [isSavingProfessionalRule, setIsSavingProfessionalRule] = useState(false);
  const salon = useMemo(() => getStoredSalon(), []);
  const canManageSecurityDocuments = user?.role === 'admin' || user?.isAdmin === true;
  const isAdmin = user?.role === 'admin' || user?.isAdmin === true;
  const registrationLink = useMemo(() => {
    const slug = businessSlug || salon?.slug;

    if (!slug) {
      return '';
    }

    return `${window.location.origin}/register/${slug}`;
  }, [salon?.slug, businessSlug]);

  useEffect(() => {
    let isMounted = true;

    async function loadBusinessProfile() {
      setIsLoadingBusinessProfile(true);

      try {
        const profile = await getSalonProfile();

        if (!isMounted) {
          return;
        }

        setBusinessForm({
          name: profile.name ?? '',
          email: profile.email ?? '',
          phone: profile.phone ? formatPhone(profile.phone) : '',
          cnpj: profile.cnpj ? formatCNPJ(profile.cnpj) : '',
          googleMapsUrl: profile.googleMapsUrl ?? '',
        });
        setBusinessSlug(profile.slug ?? '');
        setBusinessLogoUrl(profile.logoUrl ?? '');
        setPagarmeRecipientId(profile.pagarmeRecipientId ?? null);
        setPagarmeRecipientStatus(profile.pagarmeRecipientStatus ?? null);

        // Pré-popula o formulário de recebedor com os dados disponíveis
        if (profile.pagarmeRecipientId) {
          setIsLoadingRecipient(true);
          getPagarmeRecipient(profile.pagarmeRecipientId)
            .then((recipient) => {
              if (!isMounted) return;
              const ri = recipient?.register_information ?? {};
              const addr = ri?.main_address ?? ri?.address ?? {};
              const partner = Array.isArray(ri?.managing_partners) ? ri.managing_partners[0] ?? {} : {};
              const partnerAddress = partner?.address ?? {};
              const ba = recipient?.default_bank_account ?? {};
              const phone = Array.isArray(ri?.phone_numbers) ? ri.phone_numbers[0] : null;
              const partnerPhone = Array.isArray(partner?.phone_numbers) ? partner.phone_numbers[0] : null;
              const toDateInput = (value: unknown) => {
                const date = String(value ?? '').slice(0, 10);
                if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
                const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
              };
              setRecipientForm({
                name: ri.name ?? ri.company_name ?? profile.name ?? '',
                email: ri.email ?? profile.email ?? '',
                type: ri.type === 'corporation' ? 'company' : 'individual',
                document: onlyDigits(ri.document),
                phone: `${phone?.ddd ?? ''}${phone?.number ?? ''}`,
                birthdate: toDateInput(ri.birthdate),
                monthlyIncome: ri.monthly_income ? String(ri.monthly_income) : '',
                professionalOccupation: ri.professional_occupation ?? '',
                companyName: ri.company_name ?? '',
                tradingName: ri.trading_name ?? '',
                annualRevenue: ri.annual_revenue != null ? String(ri.annual_revenue) : '',
                street: addr.street ?? '',
                streetNumber: addr.number ?? addr.street_number ?? '',
                complementary: addr.complementary ?? '',
                neighborhood: addr.neighborhood ?? '',
                city: addr.city ?? '',
                state: addr.state ?? 'MG',
                zipCode: onlyDigits(addr.zip_code).slice(0, 8),
                referencePoint: addr.reference_point ?? '',
                partnerName: partner.name ?? '',
                partnerDocument: onlyDigits(partner.document_number ?? partner.document?.number ?? partner.document).slice(0, 11),
                partnerEmail: partner.email ?? '',
                partnerBirthdate: toDateInput(partner.birthdate),
                partnerMonthlyIncome: partner.monthly_income != null ? String(partner.monthly_income) : '',
                partnerProfessionalOccupation: partner.professional_occupation ?? '',
                partnerPhone: `${partnerPhone?.ddd ?? ''}${partnerPhone?.number ?? ''}`,
                partnerStreet: partnerAddress.street ?? '',
                partnerStreetNumber: partnerAddress.street_number ?? partnerAddress.number ?? '',
                partnerComplementary: partnerAddress.complementary ?? '',
                partnerNeighborhood: partnerAddress.neighborhood ?? '',
                partnerCity: partnerAddress.city ?? '',
                partnerState: partnerAddress.state ?? 'MG',
                partnerZipCode: onlyDigits(partnerAddress.zip_code).slice(0, 8),
                bankHolderName: ba.holder_name ?? '',
                bankHolderType: ba.holder_type ?? 'individual',
                bankHolderDocument: ba.holder_document ?? '',
                bank: ba.bank ?? '341',
                branchNumber: ba.branch_number ?? '',
                branchCheckDigit: ba.branch_check_digit ?? '',
                accountNumber: ba.account_number ?? '',
                accountCheckDigit: ba.account_check_digit ?? '',
              });
              setPagarmeRecipientStatus(recipient?.status ?? null);
            })
            .catch(() => {
              if (!isMounted) return;
              setPagarmeRecipientStatus('not_found');
            })
            .finally(() => { if (isMounted) setIsLoadingRecipient(false); });
        } else {
          // Pré-popula com dados da salão para facilitar o cadastro
          setRecipientForm((prev) => ({
            ...prev,
            name: profile.name ?? '',
            email: profile.email ?? '',
            document: onlyDigits(profile.cnpj).slice(0, 14),
            bankHolderDocument: onlyDigits(profile.cnpj).slice(0, 14),
            type: String(profile.cnpj ?? '').replace(/\D/g, '').length === 14 ? 'company' : 'individual',
            bankHolderType: String(profile.cnpj ?? '').replace(/\D/g, '').length === 14 ? 'company' : 'individual',
            companyName: profile.name ?? '',
            tradingName: profile.name ?? '',
          }));
        }
      } catch {
        if (isMounted) {
          toast.error('Erro ao carregar dados da salão.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingBusinessProfile(false);
        }
      }
    }

    loadBusinessProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'general' && activeTab !== 'appearance') {
      return;
    }

    let isMounted = true;

    async function loadHomeInfo() {
      setIsLoadingHomeInfo(true);

      try {
        const data = await getHomeInfo();

        if (!isMounted) {
          return;
        }

        setHomeInfo(data);
        setHeroForm({
          hero_title: data.hero_title ?? '',
          hero_subtitle: data.hero_subtitle ?? '',
          hero_images: getHeroImages(data),
        });
        setHeroImageUrl('');
        setWorkingHoursForm({
          schedule_title: data.schedule_title ?? '',
          schedule_line1: data.schedule_line1 ?? '',
          schedule_line2: data.schedule_line2 ?? '',
          schedule_line3: data.schedule_line3 ?? '',
        });
        setAboutForm({
          about_title: data.about_title ?? '',
          about_text1: data.about_text1 ?? '',
          about_text2: data.about_text2 ?? '',
          about_text3: data.about_text3 ?? '',
        });
        setLocationForm({
          location_title: data.location_title ?? '',
          location_address: data.location_address ?? '',
          location_city: data.location_city ?? '',
        });
      } catch (error) {
        if (isMounted) {
          const message = getApiErrorMessage(error);
          toast.error(message || 'Erro ao carregar informacoes da pagina inicial.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingHomeInfo(false);
        }
      }
    }

    loadHomeInfo();

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'general' || hasLoadedProfessionalRule) {
      return;
    }

    let isMounted = true;

    async function loadProfessionalRule() {
      try {
        const settingsData = await getSettings();
        if (!isMounted) return;
        setSubscriptionProfessionalRule(settingsData.subscriptionProfessionalRule ?? 'fixed');
        setSettings(settingsData);
        setHasLoadedProfessionalRule(true);
      } catch {
        // silently ignore — default 'fixed' remains
      }
    }

    loadProfessionalRule();

    return () => {
      isMounted = false;
    };
  }, [activeTab, hasLoadedProfessionalRule]);

  useEffect(() => {
    if (activeTab !== 'payments' || hasLoadedPaymentSettings) {
      return;
    }

    let isMounted = true;

    async function loadPaymentSettings() {
      setIsLoadingPaymentSettings(true);

      try {
        const [settingsData, frequencyData] = await Promise.all([
          getSettings(),
          getPaymentFrequencySettings(),
        ]);

        if (!isMounted) {
          return;
        }

        setSettings(settingsData);
        setPaymentMethods({
          cartao: !settingsData.hiddenBookingPaymentMethods.includes('cartao'),
          pix: !settingsData.hiddenBookingPaymentMethods.includes('pix'),
          local: !settingsData.hiddenBookingPaymentMethods.includes('local'),
        });
        setProfessionalPaymentFrequency(frequencyData.professionalPaymentFrequency);
        setEmployeePaymentFrequency(frequencyData.employeePaymentFrequency);
        setHasLoadedPaymentSettings(true);
      } catch {
        if (isMounted) {
          toast.error('Erro ao carregar configuracoes de pagamento.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingPaymentSettings(false);
        }
      }
    }

    loadPaymentSettings();

    return () => {
      isMounted = false;
    };
  }, [activeTab, hasLoadedPaymentSettings]);

  useEffect(() => {
    if (activeTab !== 'security' || settings) {
      return;
    }

    let isMounted = true;

    async function loadSecuritySettings() {
      setIsLoadingSecuritySettings(true);

      try {
        const settingsData = await getSettings();

        if (!isMounted) {
          return;
        }

        setSettings(settingsData);
      } catch {
        if (isMounted) {
          toast.error('Erro ao carregar documento de termos.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingSecuritySettings(false);
        }
      }
    }

    loadSecuritySettings();

    return () => {
      isMounted = false;
    };
  }, [activeTab, settings]);

  useEffect(() => {
    setProfilePhotoUrl(user?.photoUrl ?? '');
  }, [user?.photoUrl]);

  function updateBusinessField(field: keyof typeof businessForm, value: string) {
    setBusinessForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveSalonData() {
    if (!businessForm.name.trim()) {
      toast.error('O nome comercial é obrigatório.');
      return;
    }

    setIsSavingSalonData(true);
    try {
      const profile = await updateSalonProfile({
        name: businessForm.name.trim(),
        email: businessForm.email.trim(),
        phone: businessForm.phone.trim(),
        cnpj: businessForm.cnpj.replace(/\D/g, ''),
        logoUrl: businessLogoUrl,
        googleMapsUrl: businessForm.googleMapsUrl.trim(),
      });

      setBusinessForm({
        name: profile.name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        cnpj: profile.cnpj ? formatCNPJ(profile.cnpj) : '',
        googleMapsUrl: profile.googleMapsUrl ?? '',
      });
      setBusinessSlug(profile.slug ?? '');
      persistStoredSalon(profile);

      const isNew = !businessForm.cnpj.replace(/\D/g, '');
      toast.success(isNew ? 'Dados cadastrados com sucesso.' : 'Dados atualizados com sucesso.');
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao salvar dados da salão.');
    } finally {
      setIsSavingSalonData(false);
    }
  }

  function persistStoredSalon(profile: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  }) {
    localStorage.setItem(
      'salon',
      JSON.stringify({
        ...getStoredSalon(),
        id: profile.id,
        name: profile.name,
        slug: profile.slug,
        logoUrl: profile.logoUrl ?? '',
      })
    );
    window.dispatchEvent(new Event('salon:updated'));
  }

  function updateWorkingHoursField(
    field: keyof typeof workingHoursForm,
    value: string
  ) {
    setWorkingHoursForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateHeroField(
    field: keyof Pick<typeof heroForm, 'hero_title' | 'hero_subtitle'>,
    value: string
  ) {
    setHeroForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addHeroImage() {
    const trimmedUrl = heroImageUrl.trim();

    if (!trimmedUrl) {
      toast.error('Informe a URL da imagem do banner.');
      return;
    }

    if (heroForm.hero_images.includes(trimmedUrl)) {
      toast.error('Esta imagem ja foi adicionada ao banner.');
      return;
    }

    if (heroForm.hero_images.length >= MAX_HERO_IMAGES) {
      toast.error('O banner pode ter no maximo 5 imagens.');
      return;
    }

    setHeroForm((current) => ({
      ...current,
      hero_images: [...current.hero_images, trimmedUrl],
    }));
    setHeroImageUrl('');
  }

  async function uploadHeroImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione apenas arquivos de imagem.');
      return;
    }

    if (heroForm.hero_images.length >= MAX_HERO_IMAGES) {
      toast.error('O banner pode ter no maximo 5 imagens.');
      return;
    }

    setIsUploadingHeroImage(true);

    try {
      const secureUrl = await uploadHeroImage(file);

      setHeroForm((current) => {
        if (current.hero_images.includes(secureUrl)) {
          return current;
        }

        return {
          ...current,
          hero_images: [...current.hero_images, secureUrl].slice(0, MAX_HERO_IMAGES),
        };
      });

      toast.success('Foto enviada e adicionada ao banner.');
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao enviar foto para o Cloudinary.');
    } finally {
      setIsUploadingHeroImage(false);
      if (heroImageFileInputRef.current) {
        heroImageFileInputRef.current.value = '';
      }
    }
  }

  function handleHeroImageFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    void uploadHeroImageFile(file);
  }

  async function saveBusinessLogo(logoUrl: string, successMessage: string) {
    const profile = await updateSalonProfile({
      name: businessForm.name,
      email: businessForm.email,
      phone: businessForm.phone,
      cnpj: businessForm.cnpj,
      logoUrl,
      googleMapsUrl: businessForm.googleMapsUrl,
    });

    setBusinessForm({
      name: profile.name ?? '',
      email: profile.email ?? '',
      phone: profile.phone ?? '',
      cnpj: profile.cnpj ?? '',
      googleMapsUrl: profile.googleMapsUrl ?? '',
    });
    setBusinessSlug(profile.slug ?? '');
    setBusinessLogoUrl(profile.logoUrl ?? '');
    persistStoredSalon(profile);
    toast.success(successMessage);
  }

  async function uploadBusinessLogoFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione apenas arquivos de imagem.');
      return;
    }

    if (!businessForm.name.trim()) {
      toast.error('Carregue ou informe o nome comercial antes de alterar a logo.');
      return;
    }

    setIsUploadingBusinessLogo(true);

    try {
      const secureUrl = await uploadBusinessLogo(file);
      await saveBusinessLogo(secureUrl, 'Logo atualizada com sucesso.');
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao atualizar logo da salão.');
    } finally {
      setIsUploadingBusinessLogo(false);
      if (businessLogoFileInputRef.current) {
        businessLogoFileInputRef.current.value = '';
      }
    }
  }

  function handleBusinessLogoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    void uploadBusinessLogoFile(file);
  }

  async function removeBusinessLogo() {
    if (isUploadingBusinessLogo || isLoadingBusinessProfile) {
      return;
    }

    setIsUploadingBusinessLogo(true);

    try {
      await saveBusinessLogo('', 'Logo removida com sucesso.');
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao remover logo da salão.');
    } finally {
      setIsUploadingBusinessLogo(false);
    }
  }

  async function saveProfilePhoto(photoUrl: string | null, successMessage: string) {
    if (!user?.id) {
      toast.error('Usuario autenticado nao encontrado.');
      return;
    }

    const updatedUser = await updateProfilePhoto(user.id, photoUrl);

    updateUser({
      ...user,
      ...updatedUser,
      photoUrl: updatedUser.photoUrl ?? '',
    });
    setProfilePhotoUrl(updatedUser.photoUrl ?? '');
    toast.success(successMessage);
  }

  async function uploadProfilePhotoFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione apenas arquivos de imagem.');
      return;
    }

    setIsUploadingProfilePhoto(true);

    try {
      const secureUrl = await uploadProfilePhoto(file);
      await saveProfilePhoto(secureUrl, 'Foto de perfil atualizada com sucesso.');
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao atualizar foto de perfil.');
    } finally {
      setIsUploadingProfilePhoto(false);
      if (profilePhotoFileInputRef.current) {
        profilePhotoFileInputRef.current.value = '';
      }
    }
  }

  function handleProfilePhotoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    void uploadProfilePhotoFile(file);
  }

  async function removeProfilePhoto() {
    if (isUploadingProfilePhoto) {
      return;
    }

    setIsUploadingProfilePhoto(true);

    try {
      await saveProfilePhoto(null, 'Foto de perfil removida com sucesso.');
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao remover foto de perfil.');
    } finally {
      setIsUploadingProfilePhoto(false);
    }
  }

  function removeHeroImage(imageUrl: string) {
    setHeroForm((current) => ({
      ...current,
      hero_images: current.hero_images.filter((image) => image !== imageUrl),
    }));
  }

  function updateAboutField(field: keyof typeof aboutForm, value: string) {
    setAboutForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateLocationField(field: keyof typeof locationForm, value: string) {
    setLocationForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updatePaymentMethod(method: BookingPaymentMethod, enabled: boolean) {
    setPaymentMethods((current) => ({
      ...current,
      [method]: enabled,
    }));
  }

  function getHiddenBookingPaymentMethods() {
    return (Object.entries(paymentMethods) as Array<[BookingPaymentMethod, boolean]>)
      .filter(([, enabled]) => !enabled)
      .map(([method]) => method);
  }

  function updateRecipientField<K extends keyof typeof recipientForm>(field: K, value: typeof recipientForm[K]) {
    setRecipientForm((prev) => ({ ...prev, [field]: value }));
    setRecipientErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function recipientFieldClass(field: string, className: string) {
    return `${className} ${recipientErrors[field] ? 'border-destructive focus:ring-destructive' : ''}`;
  }

  async function saveRecipient() {
    const f = recipientForm;
    const document = onlyDigits(f.document);
    const isCorporation = document.length === 14;
    const errors: Record<string, boolean> = {};
    if (document.length !== 11 && !isCorporation) errors.document = true;
    if (!isCorporation && !f.name.trim()) errors.name = true;
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) errors.email = true;
    if (!/^\d{10,11}$/.test(f.phone.replace(/\D/g, ''))) errors.phone = true;
    if (!f.street.trim()) errors.street = true;
    if (!f.streetNumber.trim()) errors.streetNumber = true;
    if (!f.neighborhood.trim()) errors.neighborhood = true;
    if (!f.city.trim()) errors.city = true;
    if (f.state.trim().length !== 2) errors.state = true;
    if (onlyDigits(f.zipCode).length !== 8) errors.zipCode = true;
    if (isCorporation) {
      if (!f.companyName.trim()) errors.companyName = true;
      if (!f.tradingName.trim()) errors.tradingName = true;
      if (!f.annualRevenue || !Number.isFinite(Number(f.annualRevenue)) || Number(f.annualRevenue) < 0) errors.annualRevenue = true;
      if (!f.partnerName.trim()) errors.partnerName = true;
      if (onlyDigits(f.partnerDocument).length !== 11) errors.partnerDocument = true;
      if (!/^\S+@\S+\.\S+$/.test(f.partnerEmail.trim())) errors.partnerEmail = true;
      if (!f.partnerBirthdate) errors.partnerBirthdate = true;
      if (!f.partnerProfessionalOccupation.trim()) errors.partnerProfessionalOccupation = true;
      if (!f.partnerMonthlyIncome) errors.partnerMonthlyIncome = true;
      if (!/^\d{10,11}$/.test(f.partnerPhone.replace(/\D/g, ''))) errors.partnerPhone = true;
      if (!f.partnerStreet.trim()) errors.partnerStreet = true;
      if (!f.partnerStreetNumber.trim()) errors.partnerStreetNumber = true;
      if (!f.partnerNeighborhood.trim()) errors.partnerNeighborhood = true;
      if (!f.partnerCity.trim()) errors.partnerCity = true;
      if (f.partnerState.trim().length !== 2) errors.partnerState = true;
      if (onlyDigits(f.partnerZipCode).length !== 8) errors.partnerZipCode = true;
    } else {
      if (!f.birthdate) errors.birthdate = true;
      if (!f.professionalOccupation.trim()) errors.professionalOccupation = true;
      if (!f.monthlyIncome) errors.monthlyIncome = true;
    }
    if (!f.bankHolderName.trim() || f.bankHolderName.trim().length > 29) errors.bankHolderName = true;
    if (!f.bank.trim()) errors.bank = true;
    if (!f.branchNumber.trim()) errors.branchNumber = true;
    if (!f.accountNumber.trim()) errors.accountNumber = true;
    if (!f.accountCheckDigit.trim()) errors.accountCheckDigit = true;
    setRecipientErrors(errors);
    if (Object.keys(errors).length > 0) {
      setRecipientExpanded(true);
      const fieldLabels: Record<string, string> = {
        document: 'CPF/CNPJ', zipCode: 'CEP', partnerDocument: 'CPF do sócio',
        partnerZipCode: 'CEP do sócio', email: 'e-mail', phone: 'telefone',
        bankHolderName: 'nome bancário do titular',
      };
      const highlighted = Object.keys(errors).map((field) => fieldLabels[field] ?? field).slice(0, 4).join(', ');
      toast.error(`Revise os campos destacados em vermelho: ${highlighted}.`);
      return;
    }

    const salon = getStoredSalon();
    if (!salon?.id) { toast.error('Salão não encontrada.'); return; }

    const phoneDigits = f.phone.replace(/\D/g, '');
    const mustReplaceRecipient = Boolean(
      pagarmeRecipientId && ['refused', 'not_found'].includes(String(pagarmeRecipientStatus)),
    );
    const address = {
      street: f.street.trim(), street_number: f.streetNumber.trim(),
      complementary: f.complementary.trim() || undefined, neighborhood: f.neighborhood.trim(),
      city: f.city.trim(), state: f.state.trim().toUpperCase(), zip_code: f.zipCode.replace(/\D/g, ''),
      reference_point: f.referencePoint.trim() || undefined,
    };
    const registerInformation = isCorporation ? {
      type: 'corporation' as const, company_name: f.companyName.trim(), trading_name: f.tradingName.trim(),
      email: f.email.trim().toLowerCase(), document, annual_revenue: Number(f.annualRevenue),
      phone_numbers: [{ ddd: phoneDigits.slice(0, 2), number: phoneDigits.slice(2), type: 'mobile' }],
      main_address: { ...address, number: address.street_number },
      managing_partners: [{
        name: f.partnerName.trim(), document: f.partnerDocument.replace(/\D/g, ''),
        email: f.partnerEmail.trim().toLowerCase(), birthdate: f.partnerBirthdate,
        professional_occupation: f.partnerProfessionalOccupation.trim(), monthly_income: Number(f.partnerMonthlyIncome),
        phone_numbers: [{ ddd: f.partnerPhone.replace(/\D/g, '').slice(0, 2), number: f.partnerPhone.replace(/\D/g, '').slice(2), type: 'mobile' }],
        address: {
          street: f.partnerStreet.trim(), street_number: f.partnerStreetNumber.trim(),
          complementary: f.partnerComplementary.trim() || undefined, neighborhood: f.partnerNeighborhood.trim(),
          city: f.partnerCity.trim(), state: f.partnerState.trim().toUpperCase(), zip_code: f.partnerZipCode.replace(/\D/g, ''),
        },
      }],
    } : {
      name: f.name.trim(), email: f.email.trim().toLowerCase(), type: 'individual' as const, document,
      birthdate: f.birthdate, monthly_income: Number(f.monthlyIncome),
      professional_occupation: f.professionalOccupation.trim(),
      phone_numbers: [{ ddd: phoneDigits.slice(0, 2), number: phoneDigits.slice(2), type: 'mobile' }], address,
    };
    const payload = {
      salonId: salon.id,
      linkSalon: true as const,
      ...(pagarmeRecipientId && !mustReplaceRecipient ? { recipientId: pagarmeRecipientId } : {}),
      ...(mustReplaceRecipient ? { code: `salon_${salon.id}_replacement_${Date.now()}` } : {}),
      register_information: registerInformation,
      default_bank_account: {
        holder_name: f.bankHolderName.trim(),
        holder_type: isCorporation ? 'company' as const : 'individual' as const,
        holder_document: document,
        bank: f.bank.replace(/\D/g, ''),
        branch_number: f.branchNumber.replace(/\D/g, ''),
        branch_check_digit: f.branchCheckDigit.replace(/\D/g, '') || undefined,
        account_number: f.accountNumber.replace(/\D/g, ''),
        account_check_digit: f.accountCheckDigit.replace(/\D/g, ''),
        type: 'checking' as const,
      },
    };

    setIsSavingRecipient(true);
    try {
      let recipient;
      if (pagarmeRecipientId && !mustReplaceRecipient) {
        recipient = await updatePagarmeRecipient(pagarmeRecipientId, payload as any);
        toast.success('Recebedor atualizado com sucesso.');
      } else {
        recipient = await createPagarmeRecipient(payload);
        toast.success(mustReplaceRecipient ? 'Novo recebedor criado para substituir o cadastro recusado.' : 'Recebedor cadastrado com sucesso.');
      }
      setPagarmeRecipientId(recipient?.id ?? pagarmeRecipientId);
      setPagarmeRecipientStatus(recipient?.status ?? pagarmeRecipientStatus);
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao salvar recebedor Pagar.me.');
    } finally {
      setIsSavingRecipient(false);
    }
  }

  async function saveGeneralSettings() {
    const trimmedHeroImages = heroForm.hero_images
      .map((image) => image.trim())
      .filter(Boolean)
      .filter((image, index, allImages) => allImages.indexOf(image) === index)
      .slice(0, MAX_HERO_IMAGES);
    const trimmedHeroForm = {
      hero_title: heroForm.hero_title.trim(),
      hero_subtitle: heroForm.hero_subtitle.trim(),
      hero_image: trimmedHeroImages[0] ?? '',
      hero_images: trimmedHeroImages,
    };
    const trimmedAboutForm = {
      about_title: aboutForm.about_title.trim(),
      about_text1: aboutForm.about_text1.trim(),
      about_text2: aboutForm.about_text2.trim(),
      about_text3: aboutForm.about_text3.trim(),
    };
    const trimmedLocationForm = {
      location_title: locationForm.location_title.trim(),
      location_address: locationForm.location_address.trim(),
      location_city: locationForm.location_city.trim(),
    };
    const trimmedWorkingHoursForm = {
      schedule_title: workingHoursForm.schedule_title.trim(),
      schedule_line1: workingHoursForm.schedule_line1.trim(),
      schedule_line2: workingHoursForm.schedule_line2.trim(),
      schedule_line3: workingHoursForm.schedule_line3.trim(),
    };

    if (
      !trimmedAboutForm.about_title ||
      !trimmedAboutForm.about_text1 ||
      !trimmedAboutForm.about_text2 ||
      !trimmedAboutForm.about_text3
    ) {
      toast.error('Preencha o titulo e os 3 paragrafos da secao Sobre Nos.');
      return;
    }

    if (
      !trimmedLocationForm.location_title ||
      !trimmedLocationForm.location_address ||
      !trimmedLocationForm.location_city
    ) {
      toast.error('Preencha titulo, endereco e cidade da secao Localizacao.');
      return;
    }

    setIsSavingGeneralSettings(true);

    try {
      const [profile, updatedHomeInfo] = await Promise.all([
        updateSalonProfile({
          name: businessForm.name,
          email: businessForm.email,
          phone: businessForm.phone,
          cnpj: businessForm.cnpj,
          logoUrl: businessLogoUrl,
          googleMapsUrl: businessForm.googleMapsUrl,
        }),
        updateHomeInfo({
          ...(homeInfo ?? {}),
          ...trimmedHeroForm,
          ...trimmedAboutForm,
          ...trimmedLocationForm,
          ...trimmedWorkingHoursForm,
        }),
      ]);

      setBusinessForm({
        name: profile.name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        cnpj: profile.cnpj ?? '',
        googleMapsUrl: profile.googleMapsUrl ?? '',
      });
      setBusinessSlug(profile.slug ?? '');
      setBusinessLogoUrl(profile.logoUrl ?? '');
      persistStoredSalon(profile);
      setHomeInfo(updatedHomeInfo);
      setHeroForm({
        hero_title: updatedHomeInfo.hero_title ?? '',
        hero_subtitle: updatedHomeInfo.hero_subtitle ?? '',
        hero_images: getHeroImages(updatedHomeInfo),
      });
      setHeroImageUrl('');
      setWorkingHoursForm({
        schedule_title: updatedHomeInfo.schedule_title ?? '',
        schedule_line1: updatedHomeInfo.schedule_line1 ?? '',
        schedule_line2: updatedHomeInfo.schedule_line2 ?? '',
        schedule_line3: updatedHomeInfo.schedule_line3 ?? '',
      });
      setAboutForm({
        about_title: updatedHomeInfo.about_title ?? '',
        about_text1: updatedHomeInfo.about_text1 ?? '',
        about_text2: updatedHomeInfo.about_text2 ?? '',
        about_text3: updatedHomeInfo.about_text3 ?? '',
      });
      setLocationForm({
        location_title: updatedHomeInfo.location_title ?? '',
        location_address: updatedHomeInfo.location_address ?? '',
        location_city: updatedHomeInfo.location_city ?? '',
      });
      toast.success('Configuracoes gerais salvas com sucesso.');
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao salvar configuracoes gerais.');
    } finally {
      setIsSavingGeneralSettings(false);
    }
  }

  async function saveAppearanceSettings() {
    const trimmedHeroImages = heroForm.hero_images
      .map((image) => image.trim())
      .filter(Boolean)
      .filter((image, index, allImages) => allImages.indexOf(image) === index)
      .slice(0, MAX_HERO_IMAGES);
    const trimmedHeroForm = {
      hero_title: heroForm.hero_title.trim(),
      hero_subtitle: heroForm.hero_subtitle.trim(),
      hero_image: trimmedHeroImages[0] ?? '',
      hero_images: trimmedHeroImages,
    };

    setIsSavingGeneralSettings(true);

    try {
      const [profile, updatedHomeInfo] = await Promise.all([
        updateSalonProfile({
          name: businessForm.name,
          email: businessForm.email,
          phone: businessForm.phone,
          cnpj: businessForm.cnpj,
          logoUrl: businessLogoUrl,
          googleMapsUrl: businessForm.googleMapsUrl,
        }),
        updateHomeInfo({
          ...(homeInfo ?? {}),
          ...trimmedHeroForm,
        }),
      ]);

      setBusinessForm({
        name: profile.name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        cnpj: profile.cnpj ?? '',
        googleMapsUrl: profile.googleMapsUrl ?? '',
      });
      setBusinessSlug(profile.slug ?? '');
      setBusinessLogoUrl(profile.logoUrl ?? '');
      persistStoredSalon(profile);
      setHomeInfo(updatedHomeInfo);
      setHeroForm({
        hero_title: updatedHomeInfo.hero_title ?? '',
        hero_subtitle: updatedHomeInfo.hero_subtitle ?? '',
        hero_images: getHeroImages(updatedHomeInfo),
      });
      setHeroImageUrl('');
      toast.success('Aparencia salva com sucesso.');
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao salvar configuracoes de aparencia.');
    } finally {
      setIsSavingGeneralSettings(false);
    }
  }

  async function copyRegistrationLink() {
    if (!registrationLink) {
      toast.error('Slug da salão nao encontrado.');
      return;
    }

    await navigator.clipboard.writeText(registrationLink);
    toast.success('Link de cadastro copiado.');
  }

  async function handleChangePassword() {
    if (isChangingPassword) {
      return;
    }

    const trimmedCurrentPassword = currentPassword.trim();
    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (!trimmedCurrentPassword || !trimmedNewPassword || !trimmedConfirmPassword) {
      toast.error('Preencha todos os campos de senha.');
      return;
    }

    if (trimmedNewPassword.length < 4) {
      toast.error('A nova senha deve ter no minimo 4 caracteres.');
      return;
    }

    if (trimmedNewPassword !== trimmedConfirmPassword) {
      toast.error('A confirmacao da senha nao coincide com a nova senha.');
      return;
    }

    if (!user?.id) {
      toast.error('Usuario autenticado nao encontrado. Faca login novamente.');
      return;
    }

    setIsChangingPassword(true);

    try {
      await changePassword(user.id, {
        currentPassword: trimmedCurrentPassword,
        newPassword: trimmedNewPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Senha atualizada com sucesso.');
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao atualizar senha.');
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function saveTermsDocument(
    termsDocumentUrl: string,
    termsDocumentName: string,
    successMessage: string
  ) {
    if (!canManageSecurityDocuments) {
      toast.error('Apenas administradores podem alterar documentos.');
      return;
    }

    setIsSavingSecuritySettings(true);

    try {
      const currentSettings = settings ?? await getSettings();
      const updatedSettings = await updateSettings({
        pixKey: currentSettings.pixKey ?? '',
        termsDocumentUrl,
        termsDocumentName,
        hiddenBookingPaymentMethods:
          currentSettings.hiddenBookingPaymentMethods ?? getHiddenBookingPaymentMethods(),
        subscriptionProfessionalRule: currentSettings.subscriptionProfessionalRule ?? subscriptionProfessionalRule,
      });

      setSettings(updatedSettings);
      toast.success(successMessage);
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao salvar documento.');
    } finally {
      setIsSavingSecuritySettings(false);
    }
  }

  async function uploadTermsDocumentFile(file: File) {
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      toast.error('Selecione apenas arquivos PDF.');
      return;
    }

    setIsUploadingTermsDocument(true);

    try {
      const secureUrl = await uploadPdf(file);
      await saveTermsDocument(
        secureUrl,
        file.name,
        'Documento de termos atualizado com sucesso.'
      );
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao enviar PDF.');
    } finally {
      setIsUploadingTermsDocument(false);
      if (termsDocumentFileInputRef.current) {
        termsDocumentFileInputRef.current.value = '';
      }
    }
  }

  function handleTermsDocumentFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    void uploadTermsDocumentFile(file);
  }

  function removeTermsDocument() {
    void saveTermsDocument('', '', 'Documento de termos removido com sucesso.');
  }

  async function savePaymentSettings() {
    if (isSavingPaymentSettings || isLoadingPaymentSettings) {
      return;
    }

    setIsSavingPaymentSettings(true);

    try {
      const [updatedSettings, updatedFrequencySettings] = await Promise.all([
        updateSettings({
          pixKey: settings?.pixKey ?? '',
          termsDocumentUrl: settings?.termsDocumentUrl ?? '',
          termsDocumentName: settings?.termsDocumentName ?? '',
          hiddenBookingPaymentMethods: getHiddenBookingPaymentMethods(),
          subscriptionProfessionalRule: settings?.subscriptionProfessionalRule ?? subscriptionProfessionalRule,
        }),
        updatePaymentFrequencySettings({
          professionalPaymentFrequency,
          employeePaymentFrequency,
        }),
      ]);

      setSettings(updatedSettings);
      setPaymentMethods({
        cartao: !updatedSettings.hiddenBookingPaymentMethods.includes('cartao'),
        pix: !updatedSettings.hiddenBookingPaymentMethods.includes('pix'),
        local: !updatedSettings.hiddenBookingPaymentMethods.includes('local'),
      });
      setProfessionalPaymentFrequency(updatedFrequencySettings.professionalPaymentFrequency);
      setEmployeePaymentFrequency(updatedFrequencySettings.employeePaymentFrequency);
      setHasLoadedPaymentSettings(true);
      toast.success('Configuracoes de pagamento salvas com sucesso.');
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao salvar configuracoes de pagamento.');
    } finally {
      setIsSavingPaymentSettings(false);
    }
  }

  async function saveProfessionalRuleSettings() {
    if (isSavingProfessionalRule) return;

    setIsSavingProfessionalRule(true);

    try {
      const currentSettings = settings ?? await getSettings();
      const updatedSettings = await updateSettings({
        pixKey: currentSettings.pixKey ?? '',
        termsDocumentUrl: currentSettings.termsDocumentUrl ?? '',
        termsDocumentName: currentSettings.termsDocumentName ?? '',
        hiddenBookingPaymentMethods: currentSettings.hiddenBookingPaymentMethods ?? [],
        subscriptionProfessionalRule,
      });

      setSettings(updatedSettings);
      window.dispatchEvent(new Event('salon:updated'));
      toast.success('Regras de profissional salvas com sucesso.');
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message || 'Erro ao salvar regra de profissional.');
    } finally {
      setIsSavingProfessionalRule(false);
    }
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full lg:w-auto ${isAdmin ? 'grid-cols-5' : 'grid-cols-6'}`}>
          <TabsTrigger value="general" className="gap-2">
            <Store size={14} />
            <span className="hidden sm:inline">Configurações Gerais</span>
          </TabsTrigger>
          {!isAdmin && (
            <TabsTrigger value="notifications" className="gap-2">
              <Bell size={14} />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="security" className="gap-2">
            <Shield size={14} />
            <span className="hidden sm:inline">Segurança</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard size={14} />
            <span className="hidden sm:inline">Pagamentos</span>
          </TabsTrigger>
          {!isAdmin && (
            <TabsTrigger value="email" className="gap-2">
              <Mail size={14} />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="appearance" className="gap-2">
            <Palette size={14} />
            <span className="hidden sm:inline">Aparência</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="meuPlano" className="gap-2">
              <ClipboardList size={14} />
              <span className="hidden sm:inline">Meu Plano</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          {canShareRegistrationLink && (
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Link2 size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-foreground">
                    Link de cadastro da salão
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Envie este link para clientes se cadastrarem diretamente nesta salão.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  value={registrationLink || 'Slug da salão nao encontrado'}
                  readOnly
                  className="h-10 flex-1 rounded-md border border-border bg-secondary px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                />

                <Button
                  type="button"
                  onClick={copyRegistrationLink}
                  disabled={!registrationLink}
                  className="gap-2"
                >
                  <Copy size={14} />
                  Copiar link
                </Button>
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Informações comerciais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nome comercial</label>
                <input 
                  type="text" 
                  value={businessForm.name}
                  onChange={(event) => updateBusinessField('name', event.target.value)}
                  disabled={isLoadingBusinessProfile}
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <input 
                  type="email" 
                  value={businessForm.email}
                  onChange={(event) => updateBusinessField('email', event.target.value)}
                  disabled={isLoadingBusinessProfile}
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Contato</label>
                <input
                  type="tel"
                  value={businessForm.phone}
                  onChange={(event) => updateBusinessField('phone', event.target.value)}
                  disabled={isLoadingBusinessProfile}
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">CNPJ</label>
                <input
                  type="text"
                  value={businessForm.cnpj}
                  onChange={(event) => updateBusinessField('cnpj', event.target.value)}
                  disabled={isLoadingBusinessProfile}
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground">Link do Google Maps</label>
                <input
                  type="url"
                  value={businessForm.googleMapsUrl}
                  onChange={(event) => updateBusinessField('googleMapsUrl', event.target.value)}
                  disabled={isLoadingBusinessProfile}
                  placeholder="https://maps.app.goo.gl/..."
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">
                  Este link sera enviado junto com a mensagem de confirmacao do agendamento.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={saveSalonData}
                disabled={isSavingSalonData || isLoadingBusinessProfile}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingSalonData ? 'Salvando...' : 'Salvar informações'}
              </button>
            </div>
          </div>

          {isAdmin && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-lg font-medium text-foreground mb-1">Regra de Profissional para Assinantes</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Define como clientes com plano ativo escolhem o profissional ao agendar.
              </p>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="subscriptionProfessionalRule"
                    value="fixed"
                    checked={subscriptionProfessionalRule === 'fixed'}
                    onChange={() => setSubscriptionProfessionalRule('fixed')}
                    className="mt-1 accent-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">Profissional fixo</span>
                    <p className="text-xs text-muted-foreground">
                      O cliente fica vinculado ao profissional escolhido no primeiro agendamento após assinar. Pode trocar somente na renovação mensal ou após 30 dias.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="subscriptionProfessionalRule"
                    value="free_choice"
                    checked={subscriptionProfessionalRule === 'free_choice'}
                    onChange={() => setSubscriptionProfessionalRule('free_choice')}
                    className="mt-1 accent-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">Livre escolha</span>
                    <p className="text-xs text-muted-foreground">
                      O cliente pode escolher qualquer profissional disponível no horário e data desejados, desde que o profissional realize o serviço solicitado.
                    </p>
                  </div>
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={saveProfessionalRuleSettings}
                  disabled={isSavingProfessionalRule}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingProfessionalRule ? 'Salvando...' : 'Salvar regra'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Sobre Nos</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Titulo da Secao</label>
                <input
                  type="text"
                  value={aboutForm.about_title}
                  onChange={(event) =>
                    updateAboutField('about_title', event.target.value)
                  }
                  disabled={isLoadingHomeInfo || isSavingGeneralSettings}
                  placeholder="Sobre Nos"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Paragrafo 1</label>
                <textarea
                  value={aboutForm.about_text1}
                  onChange={(event) =>
                    updateAboutField('about_text1', event.target.value)
                  }
                  disabled={isLoadingHomeInfo || isSavingGeneralSettings}
                  rows={3}
                  className="w-full resize-y bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Paragrafo 2</label>
                <textarea
                  value={aboutForm.about_text2}
                  onChange={(event) =>
                    updateAboutField('about_text2', event.target.value)
                  }
                  disabled={isLoadingHomeInfo || isSavingGeneralSettings}
                  rows={3}
                  className="w-full resize-y bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Paragrafo 3</label>
                <textarea
                  value={aboutForm.about_text3}
                  onChange={(event) =>
                    updateAboutField('about_text3', event.target.value)
                  }
                  disabled={isLoadingHomeInfo || isSavingGeneralSettings}
                  rows={3}
                  className="w-full resize-y bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Localizacao</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground">Titulo</label>
                <input
                  type="text"
                  value={locationForm.location_title}
                  onChange={(event) =>
                    updateLocationField('location_title', event.target.value)
                  }
                  disabled={isLoadingHomeInfo || isSavingGeneralSettings}
                  placeholder="Onde estamos"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Endereco</label>
                <input
                  type="text"
                  value={locationForm.location_address}
                  onChange={(event) =>
                    updateLocationField('location_address', event.target.value)
                  }
                  disabled={isLoadingHomeInfo || isSavingGeneralSettings}
                  placeholder="Rua, numero e bairro"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Cidade</label>
                <input
                  type="text"
                  value={locationForm.location_city}
                  onChange={(event) =>
                    updateLocationField('location_city', event.target.value)
                  }
                  disabled={isLoadingHomeInfo || isSavingGeneralSettings}
                  placeholder="Cidade - UF"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Horario de Funcionamento</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Titulo</label>
                <input
                  type="text"
                  value={workingHoursForm.schedule_title}
                  onChange={(event) =>
                    updateWorkingHoursField('schedule_title', event.target.value)
                  }
                  disabled={isLoadingHomeInfo || isSavingGeneralSettings}
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Linha 1</label>
                <input
                  type="text"
                  value={workingHoursForm.schedule_line1}
                  onChange={(event) =>
                    updateWorkingHoursField('schedule_line1', event.target.value)
                  }
                  disabled={isLoadingHomeInfo || isSavingGeneralSettings}
                  placeholder="Segunda a Sexta - 09:00 as 18:00"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Linha 2</label>
                <input
                  type="text"
                  value={workingHoursForm.schedule_line2}
                  onChange={(event) =>
                    updateWorkingHoursField('schedule_line2', event.target.value)
                  }
                  disabled={isLoadingHomeInfo || isSavingGeneralSettings}
                  placeholder="Sabado - 09:00 as 18:00"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Linha 3</label>
                <input
                  type="text"
                  value={workingHoursForm.schedule_line3}
                  onChange={(event) =>
                    updateWorkingHoursField('schedule_line3', event.target.value)
                  }
                  disabled={isLoadingHomeInfo || isSavingGeneralSettings}
                  placeholder="Domingo - Fechado"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              className="gap-2"
              onClick={saveGeneralSettings}
              disabled={
                isLoadingBusinessProfile ||
                isLoadingHomeInfo ||
                isSavingGeneralSettings ||
                isUploadingBusinessLogo ||
                isUploadingHeroImage
              }
            >
              {isSavingGeneralSettings ? <Spinner /> : <Save size={14} />}
              {isSavingGeneralSettings ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Email Notifications</h3>
            <div className="space-y-4">
              {[
                { label: 'New Booking', description: 'Receive an email when a new booking is made', checked: true },
                { label: 'Booking Cancelled', description: 'Receive an email when a booking is cancelled', checked: true },
                { label: 'New Customer', description: 'Receive an email when a new customer registers', checked: false },
                { label: 'Payment Received', description: 'Receive an email when a payment is processed', checked: true },
                { label: 'Low Stock Alert', description: 'Receive an email when product stock is low', checked: true },
                { label: 'Daily Summary', description: 'Receive a daily summary of all activities', checked: false },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch defaultChecked={item.checked} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Push Notifications</h3>
            <div className="space-y-4">
              {[
                { label: 'Enable Push Notifications', description: 'Receive notifications in your browser', checked: true },
                { label: 'Sound Alerts', description: 'Play sound when notification arrives', checked: true },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch defaultChecked={item.checked} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              className="gap-2"
            >
              <Save size={14} />
              Salvar Configurações
            </Button>
          </div>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-6">

          {/* Recebedor Pagar.me */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground">Recebedor Pagar.me</h3>
                <p className="text-sm text-muted-foreground">
                  Cadastre o recebedor da salão depois do onboarding inicial. Assim o cadastro
                  da salão continua simples e os dados financeiros ficam para a etapa de
                  administração.
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-1">
              <p className="text-sm text-muted-foreground">
                Recebedor cadastrado:{' '}
                <strong className="text-foreground">{pagarmeRecipientId || 'não criado'}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Status:{' '}
                <strong className={
                  pagarmeRecipientStatus === 'active'
                    ? 'text-emerald-600'
                    : pagarmeRecipientStatus
                    ? 'text-amber-600'
                    : 'text-muted-foreground'
                }>
                  {pagarmeRecipientStatus || 'pendente'}
                </strong>
              </p>
            </div>

            {isLoadingRecipient ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Carregando dados do recebedor...
              </div>
            ) : (
              <div className="space-y-6">

                {/* Campo sempre visível + toggle */}
                <div className="space-y-3">
                  <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">
                      {recipientForm.document.replace(/\D/g, '').length === 14 ? 'Razão Social' : 'Nome completo'} <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={recipientForm.document.replace(/\D/g, '').length === 14 ? recipientForm.companyName : recipientForm.name}
                      onChange={(e) => recipientForm.document.replace(/\D/g, '').length === 14 ? updateRecipientField('companyName', e.target.value) : updateRecipientField('name', e.target.value)}
                      disabled={isSavingRecipient}
                      placeholder="Nome completo ou razão social"
                      className={recipientFieldClass(recipientForm.document.replace(/\D/g, '').length === 14 ? 'companyName' : 'name', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setRecipientExpanded((v) => !v)}
                    className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <ChevronDown
                      size={15}
                      className={`transition-transform duration-200 ${recipientExpanded ? 'rotate-180' : ''}`}
                    />
                    {recipientExpanded ? 'Ocultar campos adicionais' : 'Preencher dados completos'}
                  </button>
                </div>

                {/* Campos expandíveis */}
                {recipientExpanded && (
                  <div className="space-y-6">

                {/* Seção 1: restante dos dados do responsável */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">Dados do Responsável</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">E-mail <span className="text-destructive">*</span></label>
                      <input type="email" value={recipientForm.email} onChange={(e) => updateRecipientField('email', e.target.value)} disabled={isSavingRecipient} placeholder="email@salão.com" className={recipientFieldClass('email', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Tipo detectado pelo documento</label>
                      <input readOnly value={recipientForm.document.replace(/\D/g, '').length === 14 ? 'Pessoa Jurídica' : 'Pessoa Física'} className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">CPF / CNPJ <span className="text-destructive">*</span></label>
                      <input type="text" value={recipientForm.document} onChange={(e) => {
                        const document = e.target.value.replace(/\D/g, '').slice(0, 14);
                        const company = document.length === 14;
                        setRecipientForm((prev) => ({ ...prev, document, type: company ? 'company' : 'individual', bankHolderDocument: document, bankHolderType: company ? 'company' : 'individual' }));
                        setRecipientErrors((prev) => { const next = { ...prev }; delete next.document; return next; });
                      }} disabled={isSavingRecipient} placeholder="Apenas números" maxLength={18} className={recipientFieldClass('document', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                      {recipientErrors.document && <p className="text-xs text-destructive">CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos.</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Telefone</label>
                      <input type="tel" value={recipientForm.phone} onChange={(e) => updateRecipientField('phone', formatPhone(e.target.value))} disabled={isSavingRecipient} placeholder="(00) 00000-0000" maxLength={15} className={recipientFieldClass('phone', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>
                    {recipientForm.document.replace(/\D/g, '').length !== 14 && <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Data de Nascimento</label>
                      <input type="date" value={recipientForm.birthdate} onChange={(e) => updateRecipientField('birthdate', e.target.value)} disabled={isSavingRecipient} className={recipientFieldClass('birthdate', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>}
                    {recipientForm.document.replace(/\D/g, '').length !== 14 && <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Renda Mensal (R$)</label>
                      <input type="number" min="0" value={recipientForm.monthlyIncome} onChange={(e) => updateRecipientField('monthlyIncome', e.target.value)} disabled={isSavingRecipient} placeholder="0" className={recipientFieldClass('monthlyIncome', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>}
                    {recipientForm.document.replace(/\D/g, '').length !== 14 && <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Ocupação Profissional</label>
                      <input type="text" value={recipientForm.professionalOccupation} onChange={(e) => updateRecipientField('professionalOccupation', e.target.value)} disabled={isSavingRecipient} placeholder="Ex: Empresário" className={recipientFieldClass('professionalOccupation', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>}
                    {recipientForm.document.replace(/\D/g, '').length === 14 && <>
                      <div className="space-y-1"><label className="text-sm font-medium text-foreground">Nome Fantasia <span className="text-destructive">*</span></label><input value={recipientForm.tradingName} onChange={(e) => updateRecipientField('tradingName', e.target.value)} disabled={isSavingRecipient} className={recipientFieldClass('tradingName', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground')} /></div>
                      <div className="space-y-1"><label className="text-sm font-medium text-foreground">Receita Anual (R$) <span className="text-destructive">*</span></label><input type="number" min="0" step="0.01" value={recipientForm.annualRevenue} onChange={(e) => updateRecipientField('annualRevenue', e.target.value)} disabled={isSavingRecipient} className={recipientFieldClass('annualRevenue', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground')} /></div>
                    </>}
                  </div>
                </div>

                {/* Seção 2: Endereço */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">Endereço</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">CEP <span className="text-destructive">*</span></label>
                      <input type="text" value={recipientForm.zipCode} onChange={(e) => updateRecipientField('zipCode', onlyDigits(e.target.value).slice(0, 8))} disabled={isSavingRecipient} placeholder="00000000" maxLength={9} className={recipientFieldClass('zipCode', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                      {recipientErrors.zipCode && <p className="text-xs text-destructive">O CEP deve ter 8 dígitos.</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Rua <span className="text-destructive">*</span></label>
                      <input type="text" value={recipientForm.street} onChange={(e) => updateRecipientField('street', e.target.value)} disabled={isSavingRecipient} placeholder="Nome da rua" className={recipientFieldClass('street', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Número</label>
                      <input type="text" value={recipientForm.streetNumber} onChange={(e) => updateRecipientField('streetNumber', e.target.value)} disabled={isSavingRecipient} placeholder="123" className={recipientFieldClass('streetNumber', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Complemento</label>
                      <input type="text" value={recipientForm.complementary} onChange={(e) => updateRecipientField('complementary', e.target.value)} disabled={isSavingRecipient} placeholder="Sala, andar..." className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Bairro</label>
                      <input type="text" value={recipientForm.neighborhood} onChange={(e) => updateRecipientField('neighborhood', e.target.value)} disabled={isSavingRecipient} placeholder="Bairro" className={recipientFieldClass('neighborhood', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Cidade <span className="text-destructive">*</span></label>
                      <input type="text" value={recipientForm.city} onChange={(e) => updateRecipientField('city', e.target.value)} disabled={isSavingRecipient} placeholder="Cidade" className={recipientFieldClass('city', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Estado (UF)</label>
                      <input type="text" value={recipientForm.state} onChange={(e) => updateRecipientField('state', e.target.value.toUpperCase().slice(0, 2))} disabled={isSavingRecipient} placeholder="MG" maxLength={2} className={recipientFieldClass('state', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Ponto de Referência</label>
                      <input type="text" value={recipientForm.referencePoint} onChange={(e) => updateRecipientField('referencePoint', e.target.value)} disabled={isSavingRecipient} placeholder="Próximo a..." className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60" />
                    </div>
                  </div>
                </div>

                {recipientForm.document.replace(/\D/g, '').length === 14 && (
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">Sócio responsável</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1"><label className="text-sm font-medium">Nome <span className="text-destructive">*</span></label><input value={recipientForm.partnerName} onChange={(e) => updateRecipientField('partnerName', e.target.value)} disabled={isSavingRecipient} className={recipientFieldClass('partnerName', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm')} /></div>
                      <div className="space-y-1"><label className="text-sm font-medium">CPF <span className="text-destructive">*</span></label><input value={recipientForm.partnerDocument} onChange={(e) => updateRecipientField('partnerDocument', onlyDigits(e.target.value).slice(0, 11))} disabled={isSavingRecipient} maxLength={14} className={recipientFieldClass('partnerDocument', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm')} />{recipientErrors.partnerDocument && <p className="text-xs text-destructive">O CPF deve ter 11 dígitos.</p>}</div>
                      <div className="space-y-1"><label className="text-sm font-medium">E-mail <span className="text-destructive">*</span></label><input type="email" value={recipientForm.partnerEmail} onChange={(e) => updateRecipientField('partnerEmail', e.target.value)} disabled={isSavingRecipient} className={recipientFieldClass('partnerEmail', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm')} /></div>
                      <div className="space-y-1"><label className="text-sm font-medium">Data de nascimento <span className="text-destructive">*</span></label><input type="date" value={recipientForm.partnerBirthdate} onChange={(e) => updateRecipientField('partnerBirthdate', e.target.value)} disabled={isSavingRecipient} className={recipientFieldClass('partnerBirthdate', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm')} /></div>
                      <div className="space-y-1"><label className="text-sm font-medium">Profissão <span className="text-destructive">*</span></label><input value={recipientForm.partnerProfessionalOccupation} onChange={(e) => updateRecipientField('partnerProfessionalOccupation', e.target.value)} disabled={isSavingRecipient} className={recipientFieldClass('partnerProfessionalOccupation', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm')} /></div>
                      <div className="space-y-1"><label className="text-sm font-medium">Renda mensal (R$) <span className="text-destructive">*</span></label><input type="number" min="0" step="0.01" value={recipientForm.partnerMonthlyIncome} onChange={(e) => updateRecipientField('partnerMonthlyIncome', e.target.value)} disabled={isSavingRecipient} className={recipientFieldClass('partnerMonthlyIncome', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm')} /></div>
                      <div className="space-y-1"><label className="text-sm font-medium">Telefone <span className="text-destructive">*</span></label><input type="tel" value={recipientForm.partnerPhone} onChange={(e) => updateRecipientField('partnerPhone', formatPhone(e.target.value))} disabled={isSavingRecipient} maxLength={15} className={recipientFieldClass('partnerPhone', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm')} /></div>
                    </div>
                    <h5 className="mb-3 mt-5 text-sm font-medium text-foreground">Endereço do sócio</h5>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1"><label className="text-sm font-medium">CEP <span className="text-destructive">*</span></label><input value={recipientForm.partnerZipCode} onChange={(e) => updateRecipientField('partnerZipCode', onlyDigits(e.target.value).slice(0, 8))} disabled={isSavingRecipient} maxLength={9} className={recipientFieldClass('partnerZipCode', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm')} />{recipientErrors.partnerZipCode && <p className="text-xs text-destructive">O CEP deve ter 8 dígitos.</p>}</div>
                      <div className="space-y-1"><label className="text-sm font-medium">Rua <span className="text-destructive">*</span></label><input value={recipientForm.partnerStreet} onChange={(e) => updateRecipientField('partnerStreet', e.target.value)} disabled={isSavingRecipient} className={recipientFieldClass('partnerStreet', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm')} /></div>
                      <div className="space-y-1"><label className="text-sm font-medium">Número <span className="text-destructive">*</span></label><input value={recipientForm.partnerStreetNumber} onChange={(e) => updateRecipientField('partnerStreetNumber', e.target.value)} disabled={isSavingRecipient} className={recipientFieldClass('partnerStreetNumber', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm')} /></div>
                      <div className="space-y-1"><label className="text-sm font-medium">Complemento</label><input value={recipientForm.partnerComplementary} onChange={(e) => updateRecipientField('partnerComplementary', e.target.value)} disabled={isSavingRecipient} className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm" /></div>
                      <div className="space-y-1"><label className="text-sm font-medium">Bairro <span className="text-destructive">*</span></label><input value={recipientForm.partnerNeighborhood} onChange={(e) => updateRecipientField('partnerNeighborhood', e.target.value)} disabled={isSavingRecipient} className={recipientFieldClass('partnerNeighborhood', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm')} /></div>
                      <div className="space-y-1"><label className="text-sm font-medium">Cidade <span className="text-destructive">*</span></label><input value={recipientForm.partnerCity} onChange={(e) => updateRecipientField('partnerCity', e.target.value)} disabled={isSavingRecipient} className={recipientFieldClass('partnerCity', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm')} /></div>
                      <div className="space-y-1"><label className="text-sm font-medium">Estado (UF) <span className="text-destructive">*</span></label><input value={recipientForm.partnerState} onChange={(e) => updateRecipientField('partnerState', e.target.value.toUpperCase().slice(0, 2))} disabled={isSavingRecipient} maxLength={2} className={recipientFieldClass('partnerState', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm')} /></div>
                    </div>
                  </div>
                )}

                {/* Seção 3: Dados bancários */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">Dados Bancários</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Nome do Titular <span className="text-destructive">*</span></label>
                      <input type="text" value={recipientForm.bankHolderName} onChange={(e) => updateRecipientField('bankHolderName', e.target.value)} disabled={isSavingRecipient} placeholder="Nome como no banco" maxLength={29} className={recipientFieldClass('bankHolderName', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                      {recipientErrors.bankHolderName && <p className="text-xs text-destructive">Informe o nome bancário do titular com no máximo 29 caracteres.</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Tipo do Titular</label>
                      <input readOnly value={recipientForm.document.replace(/\D/g, '').length === 14 ? 'Pessoa Jurídica' : 'Pessoa Física'} className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">CPF/CNPJ do Titular</label>
                      <input type="text" readOnly value={recipientForm.document} className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Banco (código)</label>
                      <input type="text" value={recipientForm.bank} onChange={(e) => updateRecipientField('bank', e.target.value.replace(/\D/g, '').slice(0, 3))} disabled={isSavingRecipient} placeholder="341" maxLength={3} className={recipientFieldClass('bank', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Agência <span className="text-destructive">*</span></label>
                      <input type="text" value={recipientForm.branchNumber} onChange={(e) => updateRecipientField('branchNumber', e.target.value.replace(/\D/g, ''))} disabled={isSavingRecipient} placeholder="0001" className={recipientFieldClass('branchNumber', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Dígito da Agência</label>
                      <input type="text" value={recipientForm.branchCheckDigit} onChange={(e) => updateRecipientField('branchCheckDigit', e.target.value.replace(/\D/g, '').slice(0, 1))} disabled={isSavingRecipient} placeholder="0" maxLength={1} className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Conta <span className="text-destructive">*</span></label>
                      <input type="text" value={recipientForm.accountNumber} onChange={(e) => updateRecipientField('accountNumber', e.target.value.replace(/\D/g, ''))} disabled={isSavingRecipient} placeholder="00000" className={recipientFieldClass('accountNumber', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-foreground">Dígito da Conta <span className="text-destructive">*</span></label>
                      <input type="text" value={recipientForm.accountCheckDigit} onChange={(e) => updateRecipientField('accountCheckDigit', e.target.value.replace(/\D/g, '').slice(0, 2))} disabled={isSavingRecipient} placeholder="0" maxLength={2} className={recipientFieldClass('accountCheckDigit', 'w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60')} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-border pt-4">
                  <Button
                    type="button"
                    onClick={saveRecipient}
                    disabled={isSavingRecipient}
                    className="gap-2"
                  >
                    {isSavingRecipient ? (
                      <><Spinner /> Salvando...</>
                    ) : pagarmeRecipientId ? (
                      <><Save size={14} /> Atualizar recebedor</>
                    ) : (
                      <><Save size={14} /> Cadastrar recebedor</>
                    )}
                  </Button>
                </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Alterar Senha</h3>
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Senha Atual</label>
                <PasswordInput 
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  disabled={isChangingPassword}
                  placeholder="Digite sua senha atual"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nova Senha</label>
                <PasswordInput 
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  disabled={isChangingPassword}
                  placeholder="Digite sua nova senha"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Confirmar Nova Senha</label>
                <PasswordInput 
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={isChangingPassword}
                  placeholder="Confirme sua nova senha"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <Button
                type="button"
                onClick={handleChangePassword}
                disabled={isChangingPassword}
                className="gap-2"
              >
                {isChangingPassword && <Spinner />}
                {isChangingPassword ? 'Atualizando...' : 'Atualizar senha'}
              </Button>
            </div>
          </div>

          {canManageSecurityDocuments && (
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-foreground">
                    Termos e documentos
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Envie o PDF que sera usado como termo ou documento oficial da salão.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {settings?.termsDocumentUrl ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/40 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {settings.termsDocumentName || 'Documento em PDF'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {settings.termsDocumentUrl}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm" className="gap-2">
                        <a
                          href={settings.termsDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink size={14} />
                          Abrir PDF
                        </a>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={removeTermsDocument}
                        disabled={isSavingSecuritySettings || isUploadingTermsDocument}
                      >
                        <X size={14} />
                        Remover
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhum PDF enviado.
                  </div>
                )}

                <input
                  ref={termsDocumentFileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleTermsDocumentFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => termsDocumentFileInputRef.current?.click()}
                  disabled={
                    isLoadingSecuritySettings ||
                    isSavingSecuritySettings ||
                    isUploadingTermsDocument
                  }
                >
                  {isUploadingTermsDocument || isSavingSecuritySettings ? (
                    <Spinner />
                  ) : (
                    <Upload size={14} />
                  )}
                  {settings?.termsDocumentUrl ? 'Substituir PDF' : 'Enviar PDF'}
                </Button>
              </div>
            </div>
          )}

        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments" className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Métodos de Pagamento</h3>
            <div className="space-y-4">
              {[
                {
                  id: 'cartao' as const,
                  name: 'Cartao',
                  description: 'Credito e debito usam a mesma forma de pagamento no agendamento.',
                  icon: CreditCard,
                },
                {
                  id: 'pix' as const,
                  name: 'PIX',
                  description: 'Permitir pagamento via PIX no agendamento.',
                  icon: QrCode,
                },
                {
                  id: 'local' as const,
                  name: 'Dinheiro/Pagamento Local',
                  description: 'Permitir pagamento presencial na salão.',
                  icon: Banknote,
                },
              ].map((method) => {
                const Icon = method.icon;

                return (
                  <div key={method.id} className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{method.name}</p>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={paymentMethods[method.id]}
                    onCheckedChange={(checked) => updatePaymentMethod(method.id, checked)}
                    disabled={isLoadingPaymentSettings || isSavingPaymentSettings}
                  />
                </div>
                );
              })}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Frequencia de Pagamento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AppSelect
                label="Frequencia de pagamento - Profissionais"
                value={professionalPaymentFrequency}
                onChange={(value) =>
                  setProfessionalPaymentFrequency(value as PaymentFrequency)
                }
                options={PAYMENT_FREQUENCY_OPTIONS}
                disabled={isLoadingPaymentSettings || isSavingPaymentSettings}
              />
              <AppSelect
                label="Frequencia de pagamento - Outros funcionarios"
                value={employeePaymentFrequency}
                onChange={(value) =>
                  setEmployeePaymentFrequency(value as PaymentFrequency)
                }
                options={PAYMENT_FREQUENCY_OPTIONS}
                disabled={isLoadingPaymentSettings || isSavingPaymentSettings}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              className="gap-2"
              onClick={savePaymentSettings}
              disabled={isLoadingPaymentSettings || isSavingPaymentSettings}
            >
              {isSavingPaymentSettings ? <Spinner /> : <Save size={14} />}
              {isSavingPaymentSettings ? 'Saving...' : 'Salvar Configurações'}
            </Button>
          </div>
        </TabsContent>

        {/* Email */}
        <TabsContent value="email" className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">SMTP Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">SMTP Host</label>
                <input 
                  type="text" 
                  defaultValue="smtp.gmail.com"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">SMTP Port</label>
                <input 
                  type="number" 
                  defaultValue="587"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">SMTP Username</label>
                <input 
                  type="text" 
                  defaultValue="noreply@salaone.com.br"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">SMTP Password</label>
                <PasswordInput 
                  placeholder="••••••••••••"
                  className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Email Templates</h3>
            <div className="space-y-3">
              {[
                { name: 'Booking Confirmation', subject: 'Your booking is confirmed!' },
                { name: 'Booking Reminder', subject: 'Reminder: Your appointment tomorrow' },
                { name: 'Payment Receipt', subject: 'Payment received - Thank you!' },
                { name: 'Welcome Email', subject: 'Welcome to SalaOne!' },
              ].map((template, idx) => (
                <div key={idx} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{template.name}</p>
                    <p className="text-xs text-muted-foreground">{template.subject}</p>
                  </div>
                  <Button variant="outline" size="sm">Edit</Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              className="gap-2"
            >
              <Save size={14} />
              Salvar Configurações
            </Button>
          </div>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance" className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Foto de perfil</h3>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border border-border bg-secondary">
                {profilePhotoUrl ? (
                  <img
                    src={profilePhotoUrl}
                    alt="Foto de perfil"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <CircleUserRound size={36} className="text-primary" />
                  </div>
                )}
                {isUploadingProfilePhoto && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                    <Spinner />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <input
                  ref={profilePhotoFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfilePhotoFileChange}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => profilePhotoFileInputRef.current?.click()}
                    disabled={isUploadingProfilePhoto}
                  >
                    {isUploadingProfilePhoto ? <Spinner /> : <Upload size={14} />}
                    {profilePhotoUrl ? 'Substituir foto' : 'Enviar foto'}
                  </Button>
                  {profilePhotoUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={removeProfilePhoto}
                      disabled={isUploadingProfilePhoto}
                    >
                      <X size={14} />
                      Remover
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Esta imagem aparece no perfil do usuario e no cabecalho do sistema.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Logo da empresa</h3>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-border bg-secondary">
                {businessLogoUrl ? (
                  <img
                    src={businessLogoUrl}
                    alt="Logo da salão"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Store size={30} className="text-primary" />
                  </div>
                )}
                {isUploadingBusinessLogo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                    <Spinner />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <input
                  ref={businessLogoFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBusinessLogoFileChange}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => businessLogoFileInputRef.current?.click()}
                    disabled={isLoadingBusinessProfile || isUploadingBusinessLogo}
                  >
                    {isUploadingBusinessLogo ? <Spinner /> : <Upload size={14} />}
                    {businessLogoUrl ? 'Substituir Logo' : 'Upload New Logo'}
                  </Button>
                  {businessLogoUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={removeBusinessLogo}
                      disabled={isLoadingBusinessProfile || isUploadingBusinessLogo}
                    >
                      <X size={14} />
                      Remover
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Envie uma imagem para usar como identidade visual no sistema.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-foreground">Banner de Inicio</h3>
                <p className="text-sm text-muted-foreground">
                  Configure o texto e ate 5 imagens por URL para o banner inicial.
                </p>
              </div>
              <Badge variant="outline">
                {heroForm.hero_images.length}/{MAX_HERO_IMAGES}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Titulo do banner</label>
                  <input
                    type="text"
                    value={heroForm.hero_title}
                    onChange={(event) =>
                      updateHeroField('hero_title', event.target.value)
                    }
                    disabled={isLoadingHomeInfo || isSavingGeneralSettings}
                    placeholder="SalaOne"
                    className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Subtitulo do banner</label>
                  <input
                    type="text"
                    value={heroForm.hero_subtitle}
                    onChange={(event) =>
                      updateHeroField('hero_subtitle', event.target.value)
                    }
                    disabled={isLoadingHomeInfo || isSavingGeneralSettings}
                    placeholder="Agende seu horario com praticidade"
                    className="w-full bg-secondary text-sm text-foreground rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">URL da imagem</label>
                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    type="url"
                    value={heroImageUrl}
                    onChange={(event) => setHeroImageUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addHeroImage();
                      }
                    }}
                    disabled={
                      isLoadingHomeInfo ||
                      isSavingGeneralSettings ||
                      isUploadingHeroImage ||
                      heroForm.hero_images.length >= MAX_HERO_IMAGES
                    }
                    placeholder="https://exemplo.com/banner.jpg"
                    className="h-10 flex-1 rounded-md border border-border bg-secondary px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={addHeroImage}
                    disabled={
                      isLoadingHomeInfo ||
                      isSavingGeneralSettings ||
                      isUploadingHeroImage ||
                      heroForm.hero_images.length >= MAX_HERO_IMAGES
                    }
                  >
                    <Plus size={14} />
                    Adicionar
                  </Button>
                  <input
                    ref={heroImageFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleHeroImageFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => heroImageFileInputRef.current?.click()}
                    disabled={
                      isLoadingHomeInfo ||
                      isSavingGeneralSettings ||
                      isUploadingHeroImage ||
                      heroForm.hero_images.length >= MAX_HERO_IMAGES
                    }
                  >
                    {isUploadingHeroImage ? <Spinner /> : <Upload size={14} />}
                    {isUploadingHeroImage ? 'Enviando...' : 'Enviar foto'}
                  </Button>
                </div>
              </div>

              {heroForm.hero_images.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {heroForm.hero_images.map((imageUrl, index) => (
                    <div
                      key={imageUrl}
                      className="overflow-hidden rounded-lg border border-border bg-secondary"
                    >
                      <div className="relative aspect-video bg-background">
                        <img
                          src={imageUrl}
                          alt={`Imagem ${index + 1} do banner`}
                          className="h-full w-full object-cover"
                        />
                        {index === 0 && (
                          <Badge className="absolute left-2 top-2">
                            Principal
                          </Badge>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => removeHeroImage(imageUrl)}
                          disabled={
                            isLoadingHomeInfo ||
                            isSavingGeneralSettings ||
                            isUploadingHeroImage
                          }
                          className="absolute right-2 top-2 h-8 w-8"
                          aria-label="Remover imagem do banner"
                        >
                          <X size={14} />
                        </Button>
                      </div>
                      <p className="truncate px-3 py-2 text-xs text-muted-foreground">
                        {imageUrl}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma imagem adicionada ao banner.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              className="gap-2"
              onClick={saveAppearanceSettings}
              disabled={
                isLoadingBusinessProfile ||
                isLoadingHomeInfo ||
                isSavingGeneralSettings ||
                isUploadingProfilePhoto ||
                isUploadingBusinessLogo ||
                isUploadingHeroImage
              }
            >
              {isSavingGeneralSettings ? <Spinner /> : <Save size={14} />}
              Salvar Configurações
            </Button>
          </div>
        </TabsContent>

        {/* Meu Plano — admin only */}
        {isAdmin && (
          <TabsContent value="meuPlano" className="space-y-6">
            <PlatformSubscriptionTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
